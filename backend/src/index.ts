import 'dotenv/config'; // має бути першим — до всіх інших імпортів
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import tipsRoutes from './routes/tips';
import notificationsRoutes from './routes/notifications';
import audioRoutes from './routes/audio';

const app = express();
const PORT = process.env.PORT || 3001;

fs.mkdirSync(path.join(process.cwd(), 'uploads', 'audio'), { recursive: true });

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/reports/:reportId/audio', audioRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущено: http://localhost:${PORT}`);
  });
});
