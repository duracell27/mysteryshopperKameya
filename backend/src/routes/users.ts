import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendSms } from '../services/sms';

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
    const { phone, password, name, role, position, store } = req.body;

    if (!phone || !password || !role) {
      return res.status(400).json({ message: 'Заповніть всі обов\'язкові поля' });
    }
    if (role === 'EMPLOYEE' && (!position || !store)) {
      return res.status(400).json({ message: 'Для працівника вкажіть посаду та магазин' });
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
    const { name, position, store, password } = req.body;
    const update: Record<string, unknown> = {};

    if (name     !== undefined) update.name     = name;
    if (position !== undefined) update.position = position;
    if (store    !== undefined) update.store    = store;
    if (password) update.password = await bcrypt.hash(String(password), 12);

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// DELETE /api/users/:id
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

export default router;
