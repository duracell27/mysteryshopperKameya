import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = Router();

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('380')) return cleaned;
  if (cleaned.startsWith('0')) return '38' + cleaned;
  return cleaned;
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Введіть номер телефону та пароль' });
    }

    const normalizedPhone = normalizePhone(String(phone));
    const user = await User.findOne({ phone: normalizedPhone });

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
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});

export default router;
