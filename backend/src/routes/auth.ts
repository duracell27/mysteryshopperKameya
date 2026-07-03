import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = Router();

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
    const user = await User.findOne({
      phone: { $in: [normalizedPhone, '38' + normalizedPhone] },
    });

    if (!user) {
      return res.status(401).json({ message: 'Невірний номер телефону або пароль' });
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Невірний номер телефону або пароль' });
    }

    const token = jwt.sign(
      { userId: user._id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

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

export default router;
