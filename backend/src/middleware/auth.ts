import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    phone: string;
    isAdmin: boolean;
    division: string;
    group: string;
    position: string;
    avatarUrl?: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Не авторизовано' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as { userId: string; phone: string; isAdmin: boolean; division: string; group: string; position: string; avatarUrl?: string };

    req.user = { userId: decoded.userId, phone: decoded.phone, isAdmin: decoded.isAdmin, division: decoded.division, group: decoded.group, position: decoded.position, avatarUrl: decoded.avatarUrl };
    next();
  } catch {
    return res.status(401).json({ message: 'Невалідний токен' });
  }
};

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ message: 'Доступ заборонено' });
    return;
  }
  next();
};
