import 'dotenv/config'; // має бути першим — до всіх інших імпортів
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { connectDB } from './db';
import { AccessMatrix, DEFAULT_RULES, DEFAULT_LEARNING_RULES } from './models/AccessMatrix';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import tipsRoutes from './routes/tips';
import notificationsRoutes from './routes/notifications';
import audioRoutes from './routes/audio';
import accessMatrixRoutes from './routes/accessMatrix';
import dayplanRoutes from './routes/dayplan';
import traineeRoutes from './routes/trainee';
import onboardingAiRoutes from './routes/onboardingAi';
import shopRoutes from './routes/shop';
import libraryRoutes from './routes/library';
import { scheduleLoanReminders } from './services/libraryReminderService';

const app = express();
const PORT = process.env.PORT || 3001;

fs.mkdirSync(path.join(process.cwd(), 'uploads', 'audio'), { recursive: true });
fs.mkdirSync(path.join(process.cwd(), 'uploads', 'avatars'), { recursive: true });
fs.mkdirSync(path.join(process.cwd(), 'uploads', 'products'), { recursive: true });
fs.mkdirSync(path.join(process.cwd(), 'uploads', 'books'), { recursive: true });

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads/avatars', express.static(path.join(process.cwd(), 'uploads', 'avatars')));
app.use('/uploads/products', express.static(path.join(process.cwd(), 'uploads', 'products')));
app.use('/uploads/books', express.static(path.join(process.cwd(), 'uploads', 'books')));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports/:reportId/audio', audioRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/access-matrix', accessMatrixRoutes);
app.use('/api/dayplans', dayplanRoutes);
app.use('/api/trainees', traineeRoutes);
app.use('/api/onboarding-ai', onboardingAiRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/library', libraryRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

connectDB().then(async () => {
  const existing = await AccessMatrix.findOne();
  if (!existing) {
    await AccessMatrix.create({ rules: DEFAULT_RULES, learningRules: DEFAULT_LEARNING_RULES });
    console.log('✅ AccessMatrix seeded with defaults');
  } else if (!existing.learningRules || existing.learningRules.length === 0) {
    await AccessMatrix.updateOne({}, { $set: { learningRules: DEFAULT_LEARNING_RULES } });
    console.log('✅ AccessMatrix learning rules seeded');
  }
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущено: http://localhost:${PORT}`);
    scheduleLoanReminders();
  });
});
