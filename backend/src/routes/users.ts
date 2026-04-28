import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendSms } from '../services/sms';
import { PointsTransaction } from '../models/PointsTransaction';

const router = Router();

router.use(authMiddleware);
router.use((req: AuthRequest, res: Response, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  next();
});

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('380')) return cleaned;
  if (cleaned.startsWith('0')) return '38' + cleaned;
  return cleaned;
}

// 380XXXXXXXXX → 0XXXXXXXXX
function toDisplayPhone(phone: string): string {
  return phone.slice(2); // slice(2) дає "0XXXXXXXXX"
}

// GET /api/users
router.get('/', async (_req, res: Response) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/users
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { phone, password, name, role, position, store, birthday } = req.body;

    if (!phone || !password || !role) {
      return res.status(400).json({ message: 'Заповніть всі обов\'язкові поля' });
    }
    if (role === 'EMPLOYEE' && (!position || !store)) {
      return res.status(400).json({ message: 'Для працівника вкажіть посаду та магазин' });
    }
    if (role === 'EMPLOYEE' && !birthday) {
      return res.status(400).json({ message: 'Вкажіть дату народження' });
    }

    const normalizedPhone = normalizePhone(String(phone));
    if (await User.findOne({ phone: normalizedPhone })) {
      return res.status(409).json({ message: 'Користувач з таким номером вже існує' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 12);
    const user = await User.create({
      phone: normalizedPhone,
      password: hashedPassword,
      name: name || '',
      role,
      position: role === 'EMPLOYEE' ? position : undefined,
      store:    role === 'EMPLOYEE' ? store    : undefined,
      birthday: role === 'EMPLOYEE' && birthday ? new Date(birthday) : undefined,
    });

    try {
      const displayPhone = toDisplayPhone(normalizedPhone);
      await sendSms(
        normalizedPhone,
        `Вітаємо в Камея Таємний.\nВаш доступ до платформи:\nНомер: ${displayPhone}\nПароль: ${password}\nАдреса: mysteryshopper.kameya.if.ua`
      );
    } catch (smsError) {
      console.error('[SMS] Не вдалось надіслати:', smsError);
    }

    return res.status(201).json({
      _id: user._id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      position: user.position,
      store: user.store,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, position, store, password, role, birthday } = req.body;
    const update: Record<string, unknown> = {};

    if (name     !== undefined) update.name     = name;
    if (role     !== undefined) update.role     = role;
    if (position !== undefined) update.position = position;
    if (store    !== undefined) update.store    = store;
    if (birthday !== undefined) update.birthday = birthday ? new Date(birthday) : undefined;
    if (password) update.password = await bcrypt.hash(String(password), 12);

    const query: Record<string, unknown> = { $set: update };
    if (role === 'ADMIN') query.$unset = { position: '', store: '' };

    const user = await User.findByIdAndUpdate(req.params.id, query, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// DELETE /api/users/:id
// POST /api/users/:id/sync-points — перерахувати User.points із суми транзакцій
router.post('/:id/sync-points', async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await PointsTransaction.find({ userId: req.params.id });
    const total = transactions.reduce((sum, tx) => sum + tx.pointsAwarded, 0);
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { points: total },
      { new: true, select: '-password' }
    );
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Користувача не знайдено' });
    return res.json({ message: 'Видалено' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/users/:id/points — history of points transactions for a user (admin only)
router.get('/:id/points', async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await PointsTransaction.find({ userId: req.params.id })
      .populate('reportId', 'fileName date')
      .sort({ createdAt: -1 });
    return res.json(transactions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/users/migrate-points — одноразово ініціалізує points для всіх юзерів з транзакцій
router.post('/migrate-points', async (_req, res: Response) => {
  try {
    const users = await User.find({});
    let updated = 0;
    for (const user of users) {
      const transactions = await PointsTransaction.find({ userId: user._id });
      const total = transactions.reduce((sum, tx) => sum + tx.pointsAwarded, 0);
      if (user.points !== total) {
        await User.findByIdAndUpdate(user._id, { points: total });
        updated++;
      }
    }
    return res.json({ message: `Оновлено ${updated} користувачів`, updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка міграції' });
  }
});

export default router;
