import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { SystemLog } from '../models/SystemLog';
import { sendSms } from '../services/sms';

const router = Router();

const resetCodes = new Map<string, { code: string; expiry: number }>();

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('380')) return '0' + d.slice(3);
  if (d.startsWith('38'))  return '0' + d.slice(2);
  return d; // already 0XXXXXXXXX or other
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Введіть номер телефону та пароль' });
    }

    const normalizedPhone = normalizePhone(String(phone));
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      null;

    const user = await User.findOne({
      phone: { $in: [normalizedPhone, '38' + normalizedPhone] },
    });

    if (!user) {
      SystemLog.create({ type: 'login_failed', phone: normalizedPhone, userName: null, ip })
        .catch(() => {});
      return res.status(401).json({ message: 'Невірний номер телефону або пароль' });
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.password);
    if (!isPasswordValid) {
      SystemLog.create({ type: 'login_failed', phone: normalizedPhone, userName: user.name || null, ip })
        .catch(() => {});
      return res.status(401).json({ message: 'Невірний номер телефону або пароль' });
    }

    const token = jwt.sign(
      { userId: user._id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    SystemLog.create({ type: 'login_success', phone: normalizedPhone, userName: user.name || null, ip })
      .catch(() => {});

    return res.json({
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        position: user.position ?? null,
        store: user.store ?? null,
        role: user.role,
        points: user.points ?? 0,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});

router.post('/request-reset-code', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Вкажіть номер телефону' });

    const normalizedPhone = normalizePhone(String(phone));
    const user = await User.findOne({
      phone: { $in: [normalizedPhone, '38' + normalizedPhone] },
    });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(normalizedPhone, { code, expiry: Date.now() + 10 * 60 * 1000 });

    await sendSms(
      '38' + normalizedPhone,
      `Камея: Ваш код для зміни пароля — ${code}. Дійсний 10 хвилин.`,
    );

    return res.json({ message: 'Код надіслано' });
  } catch (error) {
    console.error('request-reset-code error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});

router.post('/confirm-reset', async (req: Request, res: Response) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) {
      return res.status(400).json({ message: 'Заповніть всі поля' });
    }

    const normalizedPhone = normalizePhone(String(phone));
    const entry = resetCodes.get(normalizedPhone);

    if (!entry) {
      return res.status(400).json({ message: 'Код не знайдено або вже використано' });
    }
    if (Date.now() > entry.expiry) {
      resetCodes.delete(normalizedPhone);
      return res.status(400).json({ message: 'Код застарів. Запросіть новий.' });
    }
    if (entry.code !== String(code)) {
      return res.status(400).json({ message: 'Невірний код' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Пароль має містити мінімум 8 символів' });
    }

    const user = await User.findOne({
      phone: { $in: [normalizedPhone, '38' + normalizedPhone] },
    });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    user.password = await bcrypt.hash(String(newPassword), 12);
    await user.save();
    resetCodes.delete(normalizedPhone);

    return res.json({ message: 'Пароль змінено' });
  } catch (error) {
    console.error('confirm-reset error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});

export default router;
