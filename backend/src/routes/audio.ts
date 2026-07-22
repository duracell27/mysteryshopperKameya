import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Report } from '../models/Report';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const AUDIO_DIR = path.join(process.cwd(), 'uploads', 'audio');

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AUDIO_DIR),
  filename:    (_req, _file, cb) => cb(null, `${randomUUID()}.mp3`),
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: (_req, file, cb) => {
    const validMime = ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'].includes(file.mimetype);
    const validExt  = file.originalname.toLowerCase().endsWith('.mp3');
    if (validMime || validExt) cb(null, true);
    else cb(new Error('Тільки MP3 файли'));
  },
});

function downloadMp3(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), 30_000);

    const request = client.get(url, (response) => {
      clearTimeout(timeoutId);

      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
        response.destroy();
        return reject(new Error('REDIRECT'));
      }

      const ct = (response.headers['content-type'] || '').toLowerCase();
      const isAudio = ct.includes('audio') || ct.includes('mpeg') || ct.includes('octet-stream');
      if (!isAudio) {
        response.destroy();
        return reject(new Error('NOT_AUDIO'));
      }

      const out = fs.createWriteStream(destPath);
      response.pipe(out);
      out.on('finish', resolve);
      out.on('error', (e) => { fs.unlink(destPath, () => {}); reject(e); });
    });

    request.on('error', (e) => { clearTimeout(timeoutId); reject(e); });
  });
}

const router = Router({ mergeParams: true });

// POST /upload — admin uploads MP3 file directly
router.post('/upload', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  audioUpload.single('audio')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Файл не завантажено' });

    const { label } = req.body as { label?: string };
    if (!label?.trim()) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'label обов\'язковий' });
    }

    try {
      const report = await Report.findById((req.params as any).reportId);
      if (!report) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Звіт не знайдено' });
      }

      (report.audioRecordings as any[]).push({
        label:        label.trim(),
        filename:     req.file.filename,
        originalName: req.file.originalname,
        uploadedAt:   new Date(),
      });
      report.markModified('audioRecordings');
      await report.save();

      return res.json(report);
    } catch (error) {
      console.error('audio upload error:', error);
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({ message: 'Помилка збереження' });
    }
  });
});

// POST /url — admin provides direct MP3 URL; server downloads and stores locally
router.post('/url', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  const { url, label } = req.body as { url?: string; label?: string };
  if (!url?.trim())   return res.status(400).json({ message: 'url обов\'язковий' });
  if (!label?.trim()) return res.status(400).json({ message: 'label обов\'язковий' });

  const report = await Report.findById((req.params as any).reportId).catch(() => null);
  if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

  const filename = `${randomUUID()}.mp3`;
  const destPath = path.join(AUDIO_DIR, filename);

  try {
    await downloadMp3(url.trim(), destPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'TIMEOUT')   return res.status(408).json({ message: 'Таймаут завантаження файлу (30 сек)' });
    if (msg === 'NOT_AUDIO') return res.status(400).json({ message: 'Посилання не веде до MP3 файлу' });
    return res.status(400).json({ message: 'Не вдалося завантажити файл за посиланням' });
  }

  try {
    const originalName = url.split('/').pop()?.split('?')[0] || 'audio.mp3';

    (report.audioRecordings as any[]).push({
      label:        label.trim(),
      filename,
      originalName,
      uploadedAt:   new Date(),
    });
    report.markModified('audioRecordings');
    await report.save();

    return res.json(report);
  } catch (error) {
    console.error('audio url save error:', error);
    fs.unlink(destPath, () => {});
    return res.status(500).json({ message: 'Помилка збереження' });
  }
});

export default router;
