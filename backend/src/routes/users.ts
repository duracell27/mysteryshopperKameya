import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendSms } from '../services/sms';
import { PointsTransaction } from '../models/PointsTransaction';
import { evaluateStudentOfYear } from '../services/badgeService';

const router = Router();

router.use(authMiddleware);
router.use((req: AuthRequest, res: Response, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  next();
});

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('380')) return '0' + d.slice(3);
  if (d.startsWith('38'))  return '0' + d.slice(2);
  return d; // already 0XXXXXXXXX or other
}

function toDisplayPhone(phone: string): string {
  return phone.startsWith('38') ? phone.slice(2) : phone;
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
    if (await User.findOne({ phone: { $in: [normalizedPhone, '38' + normalizedPhone] } })) {
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
      await sendSms(
        '38' + normalizedPhone,
        `Вітаємо в Камея Таємний.\nВаш доступ до платформи:\nНомер: ${normalizedPhone}\nПароль: ${password}\nАдреса: mysteryshopper.kameya.if.ua`
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
    const { name, position, store, password, role, phone } = req.body;
    const update: Record<string, unknown> = {};

    if (name     !== undefined) update.name     = name;
    if (role     !== undefined) update.role     = role;
    if (position !== undefined) update.position = position;
    if (store    !== undefined) update.store    = store;
    if (password) update.password = await bcrypt.hash(String(password), 12);

    if (phone !== undefined) {
      const normalized = normalizePhone(String(phone));
      const existing = await User.findOne({ phone: { $in: [normalized, '38' + normalized] }, _id: { $ne: req.params.id } });
      if (existing) return res.status(409).json({ message: 'Користувач з таким номером вже існує' });
      update.phone = normalized;
    }

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

// POST /api/users/evaluate-student-of-year — trigger Студент року evaluation for all employees (admin)
router.post('/evaluate-student-of-year', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.body as { year?: number };
    const evalYear = year ?? new Date().getFullYear();
    const employees = await User.find({ role: 'EMPLOYEE' }, '_id').lean();
    await Promise.all(employees.map(u => evaluateStudentOfYear(u._id.toString(), evalYear)));
    return res.json({ message: `Оцінено ${employees.length} працівників`, evaluated: employees.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/users/:id/badges — list badge awards for a user (admin)
router.get('/:id/badges', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id, 'badges').lean();
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    return res.json(user.badges ?? []);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/users/:id/badges — manually assign a badge (admin)
router.post('/:id/badges', async (req: AuthRequest, res: Response) => {
  try {
    const { badgeId, earnedAt, year, manual } = req.body as {
      badgeId: string;
      earnedAt?: string;
      year?: number;
      manual?: boolean;
    };
    if (!badgeId) return res.status(400).json({ message: 'badgeId обовʼязковий' });

    const award = {
      badgeId,
      earnedAt: earnedAt ? new Date(earnedAt) : new Date(),
      ...(year !== undefined && { year: Number(year) }),
      manual: manual !== false,
    };

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $push: { badges: award } },
      { new: true, select: 'badges' },
    );
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    return res.status(201).json(user.badges);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// DELETE /api/users/:id/badges/:awardId — remove a specific badge award (admin)
router.delete('/:id/badges/:awardId', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { badges: { _id: new Types.ObjectId(req.params.awardId) } } },
      { new: true, select: 'badges' },
    );
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    return res.json({ message: 'Нагороду видалено' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
