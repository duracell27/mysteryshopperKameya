import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';
import { ShopProduct } from '../models/ShopProduct';
import { ShopOrder, OrderStatus } from '../models/ShopOrder';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';
import { AccessMatrix } from '../models/AccessMatrix';

const PRODUCTS_DIR = path.join(process.cwd(), 'uploads', 'products');

const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRODUCTS_DIR),
  filename: (_req, file, cb) => {
    const ext = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  },
});

const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Тільки зображення'));
  },
});

function deleteImage(imageUrl: string) {
  if (!imageUrl) return;
  const filePath = path.join(process.cwd(), imageUrl.replace(/^\//, ''));
  fs.unlink(filePath, () => {});
}

async function checkShopAccess(req: AuthRequest): Promise<boolean> {
  if (req.user?.isAdmin) return true;
  const matrix = await AccessMatrix.findOne().lean();
  const rule = matrix?.rules.find(
    r => r.division === req.user?.division && r.position === req.user?.position
  );
  return rule?.modules?.shop === true;
}

const router = Router();
router.use(authMiddleware);

// ── Products ────────────────────────────────────────────────────────────────

// GET /api/shop/products — employee: active products
router.get('/products', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkShopAccess(req))) return res.status(403).json({ message: 'Доступ заборонено' });
    const products = await ShopProduct.find({ isActive: true }).sort({ createdAt: -1 });
    return res.json(products);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/shop/products/all — admin: all products
router.get('/products/all', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const products = await ShopProduct.find().sort({ createdAt: -1 });
    return res.json(products);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/shop/products — admin: create product (multipart)
router.post('/products', adminOnly, (req: AuthRequest, res: Response) => {
  productUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      const { name, description, price, quantity } = req.body as {
        name: string; description: string; price: string; quantity: string;
      };
      if (!name || !price) return res.status(400).json({ message: 'Назва і ціна обовʼязкові' });
      const parsedPrice = parseInt(price, 10);
      const parsedQty = parseInt(quantity ?? '0', 10);
      if (isNaN(parsedPrice) || parsedPrice < 1) {
        return res.status(400).json({ message: 'Ціна має бути цілим числом більше 0' });
      }
      const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : '';
      const product = await ShopProduct.create({
        name,
        description: description ?? '',
        imageUrl,
        price: parsedPrice,
        quantity: parsedQty,
      });
      return res.status(201).json(product);
    } catch {
      return res.status(500).json({ message: 'Помилка сервера' });
    }
  });
});

// PUT /api/shop/products/:id — admin: edit product fields
router.put('/products/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, price, quantity, isActive } = req.body as {
      name?: string; description?: string; price?: number; quantity?: number; isActive?: boolean;
    };
    const product = await ShopProduct.findByIdAndUpdate(
      req.params.id,
      { ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(quantity !== undefined && { quantity }),
        ...(isActive !== undefined && { isActive }) },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Товар не знайдено' });
    return res.json(product);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/shop/products/:id/image — admin: replace image
router.post('/products/:id/image', adminOnly, (req: AuthRequest, res: Response) => {
  productUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      if (!req.file) return res.status(400).json({ message: 'Файл не завантажено' });
      const product = await ShopProduct.findById(req.params.id);
      if (!product) return res.status(404).json({ message: 'Товар не знайдено' });
      deleteImage(product.imageUrl);
      product.imageUrl = `/uploads/products/${req.file.filename}`;
      await product.save();
      return res.json({ imageUrl: product.imageUrl });
    } catch {
      return res.status(500).json({ message: 'Помилка сервера' });
    }
  });
});

// DELETE /api/shop/products/:id — admin: delete or hide
router.delete('/products/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const product = await ShopProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Товар не знайдено' });
    const hasOrders = await ShopOrder.exists({ productId: req.params.id });
    if (hasOrders) {
      await ShopProduct.findByIdAndUpdate(req.params.id, { isActive: false });
      return res.json({ hidden: true, message: 'Товар приховано (є повʼязані замовлення)' });
    }
    deleteImage(product.imageUrl);
    await ShopProduct.findByIdAndDelete(req.params.id);
    return res.json({ deleted: true });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// ── Orders ──────────────────────────────────────────────────────────────────

// POST /api/shop/orders — place order
router.post('/orders', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkShopAccess(req))) return res.status(403).json({ message: 'Доступ заборонено' });
    const { productId } = req.body as { productId: string };
    if (!productId || !/^[a-f\d]{24}$/i.test(productId)) {
      return res.status(400).json({ message: 'Невалідний productId' });
    }

    const product = await ShopProduct.findById(productId);
    if (!product || !product.isActive) return res.status(404).json({ message: 'Товар не знайдено або недоступний' });
    if (product.quantity <= 0) return res.status(400).json({ message: 'Товар відсутній на складі' });

    const user = await User.findById(req.user!.userId);
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    if (user.points < product.price) return res.status(400).json({ message: 'Недостатньо балів' });

    user.points -= product.price;
    await user.save();
    product.quantity -= 1;
    await product.save();

    const order = await ShopOrder.create({
      userId: user._id,
      productId: product._id,
      productSnapshot: { name: product.name, price: product.price, imageUrl: product.imageUrl },
      pointsSpent: product.price,
      status: 'pending',
    });

    await PointsTransaction.create({
      userId: user._id,
      year: new Date().getFullYear(),
      scorePercent: 0,
      pointsAwarded: -product.price,
      reason: 'shop_purchase',
      note: `Покупка: ${product.name}`,
    });

    return res.status(201).json({ order, points: user.points });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/shop/orders/my — employee: own orders
router.get('/orders/my', async (req: AuthRequest, res: Response) => {
  try {
    const orders = await ShopOrder.find({ userId: req.user!.userId }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/shop/orders/pending-count — admin: badge counter
router.get('/orders/pending-count', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const count = await ShopOrder.countDocuments({ status: 'pending' });
    return res.json({ count });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/shop/orders — admin: all orders with search/filter/pagination
router.get('/orders', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;

    if (search) {
      const q = search.trim();
      const matchingUsers = await User.find(
        { name: { $regex: q, $options: 'i' } },
        '_id'
      ).lean();
      const userIds = matchingUsers.map(u => u._id);
      filter.$or = [
        { 'productSnapshot.name': { $regex: q, $options: 'i' } },
        { userId: { $in: userIds } },
      ];
    }

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    let orders = await ShopOrder.find(filter)
      .populate<{ userId: { _id: string; name: string; phone: string } }>('userId', 'name phone')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum + 1);

    const hasMore = orders.length > limitNum;
    if (hasMore) orders = orders.slice(0, limitNum);

    return res.json({ orders, hasMore });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PUT /api/shop/orders/:id/status — admin: change status
router.put('/orders/:id/status', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status, adminNote } = req.body as { status: OrderStatus; adminNote?: string };
    const allowed: OrderStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Невалідний статус' });

    const order = await ShopOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Замовлення не знайдено' });

    if (order.status === 'cancelled' || order.status === 'completed') {
      return res.status(400).json({ message: 'Не можна змінити статус завершеного або скасованого замовлення' });
    }

    if (status === 'cancelled') {
      const user = await User.findById(order.userId);
      if (user) {
        user.points += order.pointsSpent;
        await user.save();
        await PointsTransaction.create({
          userId: order.userId,
          year: new Date().getFullYear(),
          scorePercent: 0,
          pointsAwarded: order.pointsSpent,
          reason: 'shop_refund',
          note: `Повернення: ${order.productSnapshot.name}`,
        });
        // Restore quantity
        await ShopProduct.findByIdAndUpdate(order.productId, { $inc: { quantity: 1 } });
      }
    }

    order.status = status;
    if (adminNote !== undefined) order.adminNote = adminNote;
    await order.save();
    return res.json(order);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
