# Audio Recordings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to attach multiple MP3 audio recordings to mystery shopper reports, stored locally on the server; both admins and employees can play them back.

**Architecture:** Audio files are saved to `backend/uploads/audio/` with UUID filenames. Metadata is stored as a subdocument array on the Report Mongoose model. A new Express router (`audio.ts`) mounted at `/api/reports/:reportId/audio` handles upload, URL-download, Range-streaming, and delete. The frontend adds an `AudioRecordingsPanel` for admin management and inline read-only playback in the employee view.

**Tech Stack:** Node.js built-in `fs`, `https`, `http`, `crypto` (no new deps); `multer` (already installed); React + Tailwind CSS; HTML5 `<audio>` element with Range streaming.

## Global Constraints

- MP3 only: MIME `audio/mpeg`, `audio/mp3`, `audio/x-mpeg`, or `.mp3` extension
- No file size limit enforced
- Only `ADMIN` role may add or delete recordings
- `ADMIN` or report owner (`userId`) may stream recordings
- Stream route authenticates via `?token=` query param (HTML5 `<audio>` cannot send custom headers)
- Auto-label format: `"{employeeName} - {MonthUkrainian} {Year}"` e.g. `"Іваненко О. - Листопад 2025"`
- Files stored at: `{cwd}/uploads/audio/` (cwd = `backend/` when running `npm run dev`)
- All user-visible strings in Ukrainian

---

## File Map

**Create:**
- `backend/src/routes/audio.ts` — all 4 audio endpoints (upload, url, stream, delete)
- `frontend/src/components/admin/AudioRecordingsPanel.tsx` — admin add/delete/play UI

**Modify:**
- `backend/src/models/Report.ts` — add `IAudioRecording` subdoc schema + `audioRecordings` field
- `backend/src/index.ts` — create uploads dir on startup; mount audio router
- `frontend/src/types.ts` — add `AudioRecording` interface; add `audioRecordings?` to `AuditResult`
- `frontend/src/services/reportsService.ts` — add `buildAudioLabel`, `getAudioStreamUrl`, `uploadAudio`, `addAudioByUrl`, `deleteAudio`
- `frontend/src/components/admin/AdminReportsListView.tsx` — add `AudioRecordingsPanel` in report detail
- `frontend/src/components/admin/ReportsUploadView.tsx` — add pending audio state + upload after confirm
- `frontend/src/components/employee/MyReportsView.tsx` — add read-only audio list in report detail

---

### Task 1: Backend — Model + Directory + Router Registration

**Files:**
- Modify: `backend/src/models/Report.ts`
- Create: `backend/src/routes/audio.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Produces: `IAudioRecording` shape `{ label, filename, originalName, uploadedAt }`; `report.audioRecordings` array; Express route group `/api/reports/:reportId/audio/*`

- [ ] **Step 1: Add IAudioRecording subdocument to Report model**

In `backend/src/models/Report.ts`, add the interface after `ILearningPlan` (before `IReport`):

```ts
interface IAudioRecording {
  label: string;
  filename: string;
  originalName: string;
  uploadedAt: Date;
}
```

Add to `IReport` (after `affirmation?: string`):
```ts
audioRecordings?: IAudioRecording[];
```

Add the schema after `LearningPlanSchema`:
```ts
const AudioRecordingSchema = new Schema<IAudioRecording>({
  label:        { type: String, required: true },
  filename:     { type: String, required: true },
  originalName: { type: String, required: true },
  uploadedAt:   { type: Date,   required: true },
});
```

Add to `ReportSchema` definition (after `affirmation`):
```ts
audioRecordings: { type: [AudioRecordingSchema], default: [] },
```

- [ ] **Step 2: Create the audio router scaffold**

Create `backend/src/routes/audio.ts`:

```ts
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
```

- [ ] **Step 3: Mount router and create directory in index.ts**

In `backend/src/index.ts`, add these imports at the top (after existing imports):

```ts
import fs from 'fs';
import path from 'path';
import audioRoutes from './routes/audio';
```

Add before `app.use(cors(...))`:
```ts
fs.mkdirSync(path.join(process.cwd(), 'uploads', 'audio'), { recursive: true });
```

Add after `app.use('/api/reports', reportsRoutes)`:
```ts
app.use('/api/reports/:reportId/audio', audioRoutes);
```

- [ ] **Step 4: Verify server starts**

```bash
cd backend && npm run dev
```

Expected: Server starts with no errors. Directory `backend/uploads/audio/` is created.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/Report.ts backend/src/routes/audio.ts backend/src/index.ts
git commit -m "feat: add AudioRecording model, uploads dir, and audio router scaffold"
```

---

### Task 2: Backend — File Upload + URL Download Routes

**Files:**
- Modify: `backend/src/routes/audio.ts`

**Interfaces:**
- Consumes: `AUDIO_DIR`, `audioUpload`, `downloadMp3`, `authMiddleware`, `Report` model — all from Task 1 (same file)
- Produces:
  - `POST /api/reports/:reportId/audio/upload` (multipart `audio` field + `label` text field) → updated report JSON
  - `POST /api/reports/:reportId/audio/url` body `{ url: string; label: string }` → updated report JSON

- [ ] **Step 1: Add the file upload route**

In `backend/src/routes/audio.ts`, add before `export default router`:

```ts
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
```

- [ ] **Step 2: Add the URL download route**

Add after the upload route, before `export default router`:

```ts
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
```

- [ ] **Step 3: Manual smoke test — file upload**

With the dev server running, get a real admin JWT token and a report ID from MongoDB:

```bash
curl -X POST http://localhost:3001/api/reports/REPORT_ID/audio/upload \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "audio=@/path/to/test.mp3" \
  -F "label=Тест - Липень 2026"
```

Expected: `200` JSON containing `audioRecordings` array with one entry and a `.mp3` file in `backend/uploads/audio/`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/audio.ts
git commit -m "feat: add audio file upload and URL download routes"
```

---

### Task 3: Backend — Streaming + Delete Routes

**Files:**
- Modify: `backend/src/routes/audio.ts`

**Interfaces:**
- Produces:
  - `GET /api/reports/:reportId/audio/:audioId/stream?token=JWT` — auth via query, `206` with Range or `200` full file
  - `DELETE /api/reports/:reportId/audio/:audioId` — admin only, deletes file + subdoc → updated report JSON

- [ ] **Step 1: Add the streaming route**

Add before `export default router`:

```ts
// GET /:audioId/stream?token= — streams MP3 with Range support; auth via query param
router.get('/:audioId/stream', async (req: Request, res: Response) => {
  const tokenParam = req.query.token as string | undefined;
  if (!tokenParam) return res.status(401).json({ message: 'Не авторизовано' });

  let decoded: { userId: string; role: string };
  try {
    decoded = jwt.verify(
      tokenParam,
      process.env.JWT_SECRET || 'fallback-secret',
    ) as { userId: string; role: string };
  } catch {
    return res.status(401).json({ message: 'Невалідний токен' });
  }

  try {
    const report = await Report.findById((req.params as any).reportId);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    const isOwner = report.userId.toString() === decoded.userId;
    const isAdmin = decoded.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Доступ заборонено' });

    const recording = (report.audioRecordings as any[]).find(
      (a) => a._id?.toString() === req.params.audioId,
    );
    if (!recording) return res.status(404).json({ message: 'Запис не знайдено' });

    const filePath = path.join(AUDIO_DIR, recording.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Файл не знайдено на диску' });

    const stat     = fs.statSync(filePath);
    const fileSize = stat.size;
    const range    = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end   = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start > end || end >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': end - start + 1,
        'Content-Type':   'audio/mpeg',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   'audio/mpeg',
        'Accept-Ranges':  'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('audio stream error:', error);
    return res.status(500).json({ message: 'Помилка стримінгу' });
  }
});
```

- [ ] **Step 2: Add the delete route**

```ts
// DELETE /:audioId — admin only; removes file from disk and subdoc from DB
router.delete('/:audioId', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  try {
    const report = await Report.findById((req.params as any).reportId);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    const recording = (report.audioRecordings as any[]).find(
      (a) => a._id?.toString() === req.params.audioId,
    );
    if (!recording) return res.status(404).json({ message: 'Запис не знайдено' });

    fs.unlink(path.join(AUDIO_DIR, recording.filename), (err) => {
      if (err && (err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('audio unlink error:', err);
      }
    });

    (report as any).audioRecordings = (report.audioRecordings as any[]).filter(
      (a) => a._id?.toString() !== req.params.audioId,
    );
    report.markModified('audioRecordings');
    await report.save();

    return res.json(report);
  } catch (error) {
    console.error('audio delete error:', error);
    return res.status(500).json({ message: 'Помилка видалення' });
  }
});
```

- [ ] **Step 3: Manual smoke test — stream**

Take the `audioId` from Task 2's test response and use the admin JWT:

```bash
# Should respond with 206 and audio/mpeg content
curl -I "http://localhost:3001/api/reports/REPORT_ID/audio/AUDIO_ID/stream?token=YOUR_JWT" \
  -H "Range: bytes=0-1023"
```

Expected: `HTTP/1.1 206 Partial Content`, `Content-Type: audio/mpeg`, `Content-Range: bytes 0-1023/...`

- [ ] **Step 4: Manual smoke test — delete**

```bash
curl -X DELETE http://localhost:3001/api/reports/REPORT_ID/audio/AUDIO_ID \
  -H "Authorization: Bearer YOUR_JWT"
```

Expected: `200` JSON with empty `audioRecordings`. File removed from `backend/uploads/audio/`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/audio.ts
git commit -m "feat: add audio streaming (Range/206) and delete routes"
```

---

### Task 4: Frontend — Types + Service Functions

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/reportsService.ts`

**Interfaces:**
- Produces:
  - `AudioRecording` type: `{ _id, label, filename, originalName, uploadedAt }`
  - `AuditResult.audioRecordings?: AudioRecording[]`
  - `buildAudioLabel(name: string, month: number, year: number): string`
  - `getAudioStreamUrl(reportId: string, audioId: string): string`
  - `uploadAudio(reportId: string, file: File, label: string): Promise<AuditResult>`
  - `addAudioByUrl(reportId: string, url: string, label: string): Promise<AuditResult>`
  - `deleteAudio(reportId: string, audioId: string): Promise<AuditResult>`

- [ ] **Step 1: Add AudioRecording to types.ts**

In `frontend/src/types.ts`, add after the `LearningPlan` interface:

```ts
export interface AudioRecording {
  _id: string;
  label: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
}
```

In the `AuditResult` interface, add after `affirmation?: string`:
```ts
audioRecordings?: AudioRecording[];
```

- [ ] **Step 2: Add service functions to reportsService.ts**

In `frontend/src/services/reportsService.ts`, add after the `previewBadges` function at the bottom of the file:

```ts
const MONTHS_UK_AUDIO = [
  'Січень','Лютий','Березень','Квітень','Травень','Червень',
  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень',
];

export function buildAudioLabel(employeeName: string, month: number, year: number): string {
  return `${employeeName} - ${MONTHS_UK_AUDIO[month - 1] ?? month} ${year}`;
}

export function getAudioStreamUrl(reportId: string, audioId: string): string {
  const token = localStorage.getItem('kameya_token') ?? '';
  return `/api/reports/${reportId}/audio/${audioId}/stream?token=${encodeURIComponent(token)}`;
}

export const uploadAudio = async (reportId: string, file: File, label: string): Promise<AuditResult> => {
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('label', label);
  const res = await apiFetch(`/api/reports/${reportId}/audio/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Помилка завантаження аудіо');
  }
  return res.json();
};

export const addAudioByUrl = async (
  reportId: string,
  url: string,
  label: string,
): Promise<AuditResult> => {
  const res = await apiFetch(`/api/reports/${reportId}/audio/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, label }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Помилка завантаження аудіо за посиланням');
  }
  return res.json();
};

export const deleteAudio = async (reportId: string, audioId: string): Promise<AuditResult> => {
  const res = await apiFetch(`/api/reports/${reportId}/audio/${audioId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Помилка видалення аудіо');
  }
  return res.json();
};
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/reportsService.ts
git commit -m "feat: add AudioRecording type and audio service functions"
```

---

### Task 5: Frontend — AudioRecordingsPanel Component

**Files:**
- Create: `frontend/src/components/admin/AudioRecordingsPanel.tsx`

**Interfaces:**
- Consumes: `uploadAudio`, `addAudioByUrl`, `deleteAudio`, `getAudioStreamUrl`, `buildAudioLabel`, `AudioRecording` — all from Task 4
- Produces: `<AudioRecordingsPanel reportId employeeName month year recordings onUpdate />`

Props:
```ts
interface AudioRecordingsPanelProps {
  reportId: string;
  recordings: AudioRecording[];
  employeeName: string;
  month: number;
  year: number;
  onUpdate: (recordings: AudioRecording[]) => void;
}
```

- [ ] **Step 1: Create the component**

Create `frontend/src/components/admin/AudioRecordingsPanel.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import { AudioRecording } from '../../types';
import {
  uploadAudio,
  addAudioByUrl,
  deleteAudio,
  getAudioStreamUrl,
  buildAudioLabel,
} from '../../services/reportsService';

interface AudioRecordingsPanelProps {
  reportId: string;
  recordings: AudioRecording[];
  employeeName: string;
  month: number;
  year: number;
  onUpdate: (recordings: AudioRecording[]) => void;
}

export const AudioRecordingsPanel: React.FC<AudioRecordingsPanelProps> = ({
  reportId, recordings, employeeName, month, year, onUpdate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const label = buildAudioLabel(employeeName, month, year);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await uploadAudio(reportId, file, label);
      onUpdate(updated.audioRecordings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await addAudioByUrl(reportId, urlInput.trim(), label);
      onUpdate(updated.audioRecordings ?? []);
      setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (audioId: string) => {
    setError(null);
    setLoading(true);
    try {
      const updated = await deleteAudio(reportId, audioId);
      onUpdate(updated.audioRecordings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка видалення');
    } finally {
      setLoading(false);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Аудіозаписи
      </h4>

      {recordings.length === 0 && (
        <p className="text-sm text-gray-400 mb-3">Записів немає</p>
      )}

      <div className="space-y-2 mb-3">
        {recordings.map((rec) => (
          <div
            key={rec._id}
            className="flex flex-col gap-1 p-2 bg-gray-50 dark:bg-gray-800 rounded"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[60%]">
                {rec.label}
              </span>
              {deleteConfirmId === rec._id ? (
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => handleDelete(rec._id)}
                    disabled={loading}
                    className="text-red-600 hover:underline"
                  >
                    Підтвердити
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="text-gray-500 hover:underline"
                  >
                    Скасувати
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirmId(rec._id)}
                  disabled={loading}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Видалити
                </button>
              )}
            </div>
            <audio
              controls
              className="w-full h-8"
              src={getAudioStreamUrl(reportId, rec._id)}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="text-sm px-3 py-1.5 border border-dashed border-gray-400 rounded hover:border-blue-500 hover:text-blue-600 transition-colors text-gray-600 dark:text-gray-300 disabled:opacity-50"
        >
          {loading ? 'Завантаження...' : '+ Обрати MP3 файл'}
        </button>

        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Пряме посилання на MP3..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            disabled={loading}
            className="flex-1 text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          />
          <button
            onClick={handleAddUrl}
            disabled={loading || !urlInput.trim()}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Додати
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/AudioRecordingsPanel.tsx
git commit -m "feat: add AudioRecordingsPanel component"
```

---

### Task 6: Frontend — Wire AudioRecordingsPanel into AdminReportsListView

**Files:**
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

**Interfaces:**
- Consumes: `AudioRecordingsPanel` from Task 5

The `selected` report state holds `ReportWithUser` which extends `AuditResult` — it now has `audioRecordings?` from Task 4.

- [ ] **Step 1: Add import**

In `frontend/src/components/admin/AdminReportsListView.tsx`, add:

```ts
import { AudioRecordingsPanel } from './AudioRecordingsPanel';
```

- [ ] **Step 2: Add panel in the selected report detail section**

In `AdminReportsListView`, find where the selected report detail is rendered (search for `selected &&` or the `selected` detail panel — it renders sections, learning plan, etc.). Add `AudioRecordingsPanel` at the bottom of the detail card, inside the `selected` guard:

```tsx
<AudioRecordingsPanel
  reportId={selected._id ?? selected.id ?? ''}
  recordings={selected.audioRecordings ?? []}
  employeeName={
    typeof selected.userId === 'object' && selected.userId !== null
      ? (selected.userId as { name: string }).name
      : '?'
  }
  month={
    selected.month ??
    parseInt((selected.date ?? '').slice(5, 7), 10) ||
    new Date().getMonth() + 1
  }
  year={selected.year ?? new Date().getFullYear()}
  onUpdate={(recs) =>
    setSelected((prev) => (prev ? { ...prev, audioRecordings: recs } : prev))
  }
/>
```

- [ ] **Step 3: Verify TypeScript and test UI**

```bash
cd frontend && npx tsc --noEmit && npm run dev
```

Open admin → Reports list → select any report → scroll to bottom of detail panel → verify "Аудіозаписи" section appears with upload controls. Upload an MP3 file, verify it appears with playback. Delete it, verify it disappears.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/AdminReportsListView.tsx
git commit -m "feat: add audio recordings panel to admin report detail view"
```

---

### Task 7: Frontend — Pending Audio in ReportsUploadView

**Files:**
- Modify: `frontend/src/components/admin/ReportsUploadView.tsx`

Audios are collected as pending during the `preview` step and uploaded sequentially inside `handleConfirm` (which already runs during the `saving` step) after `confirmReport` returns the new `report._id`.

- [ ] **Step 1: Add imports and new state**

In `frontend/src/components/admin/ReportsUploadView.tsx`, add to existing imports:

```ts
import { uploadAudio, addAudioByUrl, buildAudioLabel } from '../../services/reportsService';
```

Add new state alongside the other `useState` hooks:

```ts
type PendingAudio = { type: 'file'; file: File } | { type: 'url'; url: string };
const [pendingAudios, setPendingAudios] = useState<PendingAudio[]>([]);
const [pendingUrlInput, setPendingUrlInput] = useState('');
const audioFileRef = useRef<HTMLInputElement>(null);
const [audioUploadWarning, setAudioUploadWarning] = useState<string | null>(null);
```

- [ ] **Step 2: Reset new state in handleReset**

In the `handleReset` function, add alongside the other resets:

```ts
setPendingAudios([]);
setPendingUrlInput('');
setAudioUploadWarning(null);
if (audioFileRef.current) audioFileRef.current.value = '';
```

- [ ] **Step 3: Upload pending audios inside handleConfirm**

In `handleConfirm`, after `const result = await confirmReport({...})` and before `setAwardedPoints(result.pointsAwarded)`:

```ts
// Upload any pending audio recordings
if (pendingAudios.length > 0 && result._id) {
  const audioLabel = buildAudioLabel(
    selectedEmployee?.name ?? '',
    selectedMonth,
    selectedYear,
  );
  const failed: string[] = [];
  for (const pa of pendingAudios) {
    try {
      if (pa.type === 'file') {
        await uploadAudio(result._id, pa.file, audioLabel);
      } else {
        await addAudioByUrl(result._id, pa.url, audioLabel);
      }
    } catch {
      failed.push(pa.type === 'file' ? pa.file.name : pa.url);
    }
  }
  if (failed.length > 0) {
    setAudioUploadWarning(`Анкету збережено, але не вдалося завантажити аудіо: ${failed.join(', ')}`);
  }
  setPendingAudios([]);
}
```

- [ ] **Step 4: Add audio section JSX in the preview step**

In the JSX where `step === 'preview'` is rendered, find the section just before the confirm button (the `openConfirmModal` button). Add this block before it:

```tsx
{/* Pending audio section */}
<div className="mt-4 pt-4 border-t border-slate-200">
  <h4 className="text-sm font-semibold text-slate-700 mb-2">
    Аудіозаписи <span className="font-normal text-slate-400">(необов'язково)</span>
  </h4>

  {pendingAudios.length > 0 && (
    <ul className="mb-2 space-y-1">
      {pendingAudios.map((pa, i) => (
        <li
          key={i}
          className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1.5"
        >
          <span className="truncate max-w-[80%] text-slate-600">
            {pa.type === 'file' ? pa.file.name : pa.url}
          </span>
          <button
            onClick={() => setPendingAudios((prev) => prev.filter((_, j) => j !== i))}
            className="text-red-500 hover:text-red-700 ml-2 shrink-0"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )}

  <input
    ref={audioFileRef}
    type="file"
    accept=".mp3,audio/mpeg"
    className="hidden"
    onChange={(e) => {
      const f = e.target.files?.[0];
      if (f) {
        setPendingAudios((prev) => [...prev, { type: 'file', file: f }]);
        if (audioFileRef.current) audioFileRef.current.value = '';
      }
    }}
  />

  <div className="flex flex-col gap-2">
    <button
      onClick={() => audioFileRef.current?.click()}
      className="text-sm px-3 py-1.5 border border-dashed border-slate-400 rounded hover:border-kameya-burgundy hover:text-kameya-burgundy transition-colors text-slate-600"
    >
      + Обрати MP3 файл
    </button>
    <div className="flex gap-2">
      <input
        type="url"
        placeholder="Пряме посилання на MP3..."
        value={pendingUrlInput}
        onChange={(e) => setPendingUrlInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && pendingUrlInput.trim()) {
            setPendingAudios((prev) => [...prev, { type: 'url', url: pendingUrlInput.trim() }]);
            setPendingUrlInput('');
          }
        }}
        className="flex-1 text-sm px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-800"
      />
      <button
        onClick={() => {
          if (pendingUrlInput.trim()) {
            setPendingAudios((prev) => [...prev, { type: 'url', url: pendingUrlInput.trim() }]);
            setPendingUrlInput('');
          }
        }}
        disabled={!pendingUrlInput.trim()}
        className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Додати
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Show audio warning on done step**

In the `step === 'done'` JSX, add after the `smsSent` block (before the reset button):

```tsx
{audioUploadWarning && (
  <div className="px-6 py-3 rounded-xl text-sm font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 max-w-sm text-center">
    <i className="fas fa-triangle-exclamation mr-2" />
    {audioUploadWarning}
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript and test flow**

```bash
cd frontend && npx tsc --noEmit && npm run dev
```

Open admin → Upload report → parse a PDF → at preview step verify the "Аудіозаписи" section appears → add 1 file → confirm → verify the audio appears on the saved report (check via AdminReportsListView).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/ReportsUploadView.tsx
git commit -m "feat: add pending audio upload to report creation flow"
```

---

### Task 8: Frontend — Read-Only Audio Playback in MyReportsView

**Files:**
- Modify: `frontend/src/components/employee/MyReportsView.tsx`

**Interfaces:**
- Consumes: `getAudioStreamUrl` from Task 4; `audioRecordings` from `AuditResult` (Task 4)

- [ ] **Step 1: Add import**

In `frontend/src/components/employee/MyReportsView.tsx`, add:

```ts
import { getAudioStreamUrl } from '../../services/reportsService';
```

- [ ] **Step 2: Add audio section in the selected report detail**

Find the selected report detail JSX (where `selected` is rendered with sections, reflection, AI recommendations, etc.). Add the audio section at a logical point within the detail view — after the reflection/AI block and before or after the learning plan section:

```tsx
{(selected.audioRecordings?.length ?? 0) > 0 && (
  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
    <h4 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
      Аудіозаписи
    </h4>
    <div className="space-y-3">
      {selected.audioRecordings!.map((rec) => (
        <div key={rec._id} className="flex flex-col gap-1">
          <span className="text-xs text-slate-500 dark:text-gray-400">{rec.label}</span>
          <audio
            controls
            className="w-full"
            src={getAudioStreamUrl(selected._id ?? selected.id ?? '', rec._id)}
          />
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript and test UI**

```bash
cd frontend && npx tsc --noEmit && npm run dev
```

Log in as an employee → open My Reports → open a report that has audio attached (attach one via admin panel first) → verify the "Аудіозаписи" section appears with working audio playback.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/employee/MyReportsView.tsx
git commit -m "feat: show audio recordings with playback in employee report view"
```

---

## Self-Review

**Spec coverage:**
- ✅ Multiple recordings per report — `audioRecordings[]` array
- ✅ File browser upload — Task 2 `POST /upload`, Task 5 file input, Task 7 pending files
- ✅ URL download (server-side) — Task 2 `POST /url` with `downloadMp3()`
- ✅ Local file storage — `backend/uploads/audio/` with UUID filenames
- ✅ MP3 only — multer fileFilter + content-type check
- ✅ No file size limit — no multer `limits` set
- ✅ Auto-label from name + month + year — `buildAudioLabel()` Task 4
- ✅ Admin can delete — Task 3 DELETE route + Task 5 delete button with confirm
- ✅ Add during creation — Task 7 pending audios uploaded after `confirmReport`
- ✅ Add to existing report — Task 6 `AudioRecordingsPanel` in `AdminReportsListView`
- ✅ Employee can play — Task 8 `MyReportsView`
- ✅ Range/206 streaming — Task 3 stream route
- ✅ Token in `?token=` query — Task 3 stream route + `getAudioStreamUrl()` Task 4
- ✅ URL download timeout 30s — `downloadMp3()` `setTimeout` 30_000 ms
- ✅ Content-type validation for URL — `downloadMp3()` checks `Content-Type` header
- ✅ Delete removes file from disk — `fs.unlink` in Task 3 delete route
- ✅ Graceful missing file on stream — 404 if `!fs.existsSync(filePath)`
- ✅ Bad Range → 416 — Task 3 stream route range validation

**Placeholder scan:** No TBD, TODO, or incomplete steps.

**Type consistency:**
- `IAudioRecording` (backend) and `AudioRecording` (frontend) match: `label`, `filename`, `originalName`, `uploadedAt`
- `uploadAudio(reportId, file, label)` — consistent across Task 4 definition, Task 5 call, Task 7 call
- `addAudioByUrl(reportId, url, label)` — consistent across Task 4 definition, Task 5 call, Task 7 call
- `deleteAudio(reportId, audioId)` — consistent across Task 4 definition, Task 5 call
- `getAudioStreamUrl(reportId, audioId)` — consistent across Task 4 definition, Tasks 5, 6, 8 usage
- `buildAudioLabel(name, month, year)` — consistent across Task 4 definition, Tasks 6, 7 usage
- `AudioRecordingsPanel` props — defined in Task 5, consumed in Tasks 6, 7 (Task 7 uses pending-only approach, no panel)
- `onUpdate: (recordings: AudioRecording[]) => void` — Task 5 definition matches Task 6 usage
