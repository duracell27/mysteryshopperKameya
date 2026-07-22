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

export default router;
