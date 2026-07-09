# Admin Notifications System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Сповіщення" menu item to the admin panel that tracks reflection submissions, learning plan generation and completion (with links to reports), plus a "Системні сповіщення" panel for login events — all stored in MongoDB.

**Architecture:** Event-driven — each employee action fires a fire-and-forget `Notification.create()` call inside the existing Express routes. Login events fire `SystemLog.create()` inside the auth route. A new `/api/notifications` route serves all admin reads and mark-as-read. The React side polls unread counts every 60 s and renders a badge on the sidebar nav item.

**Tech Stack:** Express + TypeScript + Mongoose (backend), React + TailwindCSS + FontAwesome (frontend), no new npm dependencies required.

## Global Constraints

- All user-facing strings are Ukrainian
- TailwindCSS utility classes only — no inline `style` objects
- FontAwesome icons via `fas fa-*` className
- All notification/log creation in backend is fire-and-forget (`.catch()` only, never `await` in the main response path)
- Admin-only endpoints return 403 for non-ADMIN role
- `kameya-burgundy` is the existing brand color token (used throughout the app)

---

### Task 1: Backend — Mongoose models for Notification and SystemLog

**Files:**
- Create: `backend/src/models/Notification.ts`
- Create: `backend/src/models/SystemLog.ts`

**Interfaces:**
- Produces:
  - `Notification` model with `INotification` interface
  - `SystemLog` model with `ISystemLog` interface
  - Both exported and ready to import in routes

- [ ] **Step 1: Create `backend/src/models/Notification.ts`**

```ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export type NotificationType = 'reflection_submitted' | 'plan_generated' | 'plan_completed';

export interface INotification extends Document {
  type: NotificationType;
  userId: Types.ObjectId;
  reportId: Types.ObjectId;
  userName: string;
  reportFileName: string;
  isOnTime: boolean | null;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ['reflection_submitted', 'plan_generated', 'plan_completed'],
      required: true,
    },
    userId:         { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    reportId:       { type: Schema.Types.ObjectId, ref: 'Report', required: true },
    userName:       { type: String, required: true },
    reportFileName: { type: String, required: true },
    isOnTime:       { type: Boolean, default: null },
    isRead:         { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
```

- [ ] **Step 2: Create `backend/src/models/SystemLog.ts`**

```ts
import mongoose, { Schema, Document } from 'mongoose';

export type SystemLogType = 'login_success' | 'login_failed';

export interface ISystemLog extends Document {
  type: SystemLogType;
  phone: string;
  userName: string | null;
  ip: string | null;
  isRead: boolean;
  createdAt: Date;
}

const SystemLogSchema = new Schema<ISystemLog>(
  {
    type:     { type: String, enum: ['login_success', 'login_failed'], required: true },
    phone:    { type: String, required: true },
    userName: { type: String, default: null },
    ip:       { type: String, default: null },
    isRead:   { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SystemLogSchema.index({ isRead: 1 });
SystemLogSchema.index({ createdAt: -1 });

export const SystemLog = mongoose.model<ISystemLog>('SystemLog', SystemLogSchema);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/Notification.ts backend/src/models/SystemLog.ts
git commit -m "feat: add Notification and SystemLog mongoose models"
```

---

### Task 2: Backend — Notifications API route + register in index.ts

**Files:**
- Create: `backend/src/routes/notifications.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `Notification` and `SystemLog` from Task 1, `authMiddleware` and `AuthRequest` from `../middleware/auth`
- Produces:
  - `GET /api/notifications` → `INotification[]` (limit 100, newest first)
  - `GET /api/notifications/unread-count` → `{ count: number }`
  - `PATCH /api/notifications/:id/read` → updated `INotification`
  - `GET /api/notifications/system` → `ISystemLog[]` (limit 200, newest first)
  - `GET /api/notifications/system/unread-count` → `{ count: number }`
  - `PATCH /api/notifications/system/:id/read` → updated `ISystemLog`

- [ ] **Step 1: Create `backend/src/routes/notifications.ts`**

```ts
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { SystemLog } from '../models/SystemLog';

const router = Router();
router.use(authMiddleware);

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ message: 'Доступ заборонено' });
    return false;
  }
  return true;
}

// Specific routes before wildcard routes to avoid Express matching collisions

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const count = await Notification.countDocuments({ isRead: false });
    return res.json({ count });
  } catch (error) {
    console.error('notifications unread-count error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.get('/system/unread-count', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const count = await SystemLog.countDocuments({ isRead: false });
    return res.json({ count });
  } catch (error) {
    console.error('system unread-count error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.get('/system', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const logs = await SystemLog.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json(logs);
  } catch (error) {
    console.error('system logs error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.patch('/system/:id/read', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const log = await SystemLog.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!log) return res.status(404).json({ message: 'Лог не знайдено' });
    return res.json(log);
  } catch (error) {
    console.error('mark system read error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json(notifications);
  } catch (error) {
    console.error('notifications list error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Сповіщення не знайдено' });
    return res.json(notification);
  } catch (error) {
    console.error('mark read error:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
```

- [ ] **Step 2: Register in `backend/src/index.ts` — add 2 lines**

Add the import after the existing imports:
```ts
import notificationsRoutes from './routes/notifications';
```

Add the route registration after `app.use('/api/tips', tipsRoutes);`:
```ts
app.use('/api/notifications', notificationsRoutes);
```

The full updated `index.ts` should look like:
```ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import tipsRoutes from './routes/tips';
import notificationsRoutes from './routes/notifications';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущено: http://localhost:${PORT}`);
  });
});
```

- [ ] **Step 3: Compile and manual verify**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

Start the server and test with curl (replace TOKEN with a real admin JWT from your browser localStorage):
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/notifications/unread-count
# Expected: {"count":0}

curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/notifications
# Expected: []

curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/notifications/system
# Expected: []
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/notifications.ts backend/src/index.ts
git commit -m "feat: add notifications API route with admin-only endpoints"
```

---

### Task 3: Backend — Log login events in auth.ts

**Files:**
- Modify: `backend/src/routes/auth.ts`

**Interfaces:**
- Consumes: `SystemLog` from Task 1
- Produces: Every login attempt (success or failure) creates a `SystemLog` document (fire-and-forget)

- [ ] **Step 1: Replace `backend/src/routes/auth.ts` with the updated version**

The change: import `SystemLog`, extract IP, and fire `.create()` at each branch of the login handler.

```ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { SystemLog } from '../models/SystemLog';

const router = Router();

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('380')) return '0' + d.slice(3);
  if (d.startsWith('38'))  return '0' + d.slice(2);
  return d;
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

export default router;
```

- [ ] **Step 2: Test login events manually**

Log in as a real user (via the app or curl), then:
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3001/api/notifications/system
# Expected: array with one login_success entry with phone and userName
```

Try a wrong password login, then check:
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3001/api/notifications/system
# Expected: new login_failed entry appears at top
```

- [ ] **Step 3: Compile**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/auth.ts
git commit -m "feat: log login success and failure events to SystemLog"
```

---

### Task 4: Backend — Fire Notification from report events

**Files:**
- Modify: `backend/src/routes/reports.ts`

**Interfaces:**
- Consumes: `Notification` from Task 1
- Produces:
  - `POST /:id/reflection` success → creates `Notification` with `type: 'reflection_submitted'`
  - `POST /:id/generate-learning-plan` success (when `saved` is non-null) → creates `Notification` with `type: 'plan_generated'`
  - `PATCH /:id/learning-plan/:taskIndex` when all tasks complete → creates `Notification` with `type: 'plan_completed'`

- [ ] **Step 1: Add Notification import to `backend/src/routes/reports.ts`**

Find the existing import block at the top of the file and add:
```ts
import { Notification } from '../models/Notification';
```

(Add it after the existing imports, e.g. after `import { YEARLY_BADGE_IDS } from '../constants/badges';`)

- [ ] **Step 2: Hook into `POST /:id/reflection` — add notification after `report.save()`**

Find the reflection route handler (around line 947). After `await report.save();` and before `return res.json(report);`, insert:

```ts
    await report.save();

    // fire-and-forget notification
    User.findById(report.userId, 'name').lean()
      .then(u => Notification.create({
        type: 'reflection_submitted',
        userId: report.userId,
        reportId: report._id,
        userName: u?.name || 'Невідомий',
        reportFileName: report.fileName,
        isOnTime,
      }))
      .catch(err => console.error('[notification] reflection_submitted failed:', err));

    return res.json(report);
```

- [ ] **Step 3: Hook into `POST /:id/generate-learning-plan` — add notification after successful save**

Find the generate-learning-plan handler. Just before `return res.json(saved ?? await Report.findById(report._id));`, insert:

```ts
    if (saved) {
      User.findById(report.userId, 'name').lean()
        .then(u => Notification.create({
          type: 'plan_generated',
          userId: report.userId,
          reportId: report._id,
          userName: u?.name || 'Невідомий',
          reportFileName: report.fileName,
          isOnTime: null,
        }))
        .catch(err => console.error('[notification] plan_generated failed:', err));
    }

    return res.json(saved ?? await Report.findById(report._id));
```

- [ ] **Step 4: Hook into `PATCH /:id/learning-plan/:taskIndex` — add notification when all tasks complete**

Find the existing block (around line 935):
```ts
    if (report.learningPlan?.tasks.every(t => t.isCompleted)) {
      evaluateOnLearningPlanComplete(report.userId.toString(), report._id.toString())
        .catch(err => console.error('[badge] learning plan eval failed:', err));
    }
```

Replace it with:
```ts
    if (report.learningPlan?.tasks.every(t => t.isCompleted)) {
      evaluateOnLearningPlanComplete(report.userId.toString(), report._id.toString())
        .catch(err => console.error('[badge] learning plan eval failed:', err));

      const deadline = report.learningPlan.deadline;
      const isOnTimePlan = deadline ? new Date() <= new Date(deadline) : null;
      User.findById(report.userId, 'name').lean()
        .then(u => Notification.create({
          type: 'plan_completed',
          userId: report.userId,
          reportId: report._id,
          userName: u?.name || 'Невідомий',
          reportFileName: report.fileName,
          isOnTime: isOnTimePlan,
        }))
        .catch(err => console.error('[notification] plan_completed failed:', err));
    }
```

- [ ] **Step 5: Compile**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Manual verify — submit a reflection**

As an employee, submit a reflection on a report. Then as admin:
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3001/api/notifications
# Expected: array containing one notification with type "reflection_submitted"

curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3001/api/notifications/unread-count
# Expected: {"count":1}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: fire Notification events on reflection, plan generation and completion"
```

---

### Task 5: Frontend — Types, notificationsService, and timeAgo utility

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/dateFormatter.ts`
- Create: `frontend/src/services/notificationsService.ts`

**Interfaces:**
- Produces:
  - `Screen.ADMIN_NOTIFICATIONS` enum value
  - `AdminNotification` and `SystemLogEntry` interfaces
  - `timeAgo(dateStr: string): string` export from `dateFormatter.ts`
  - All 6 `notificationsService` functions

- [ ] **Step 1: Add to `frontend/src/types.ts` — extend Screen enum**

Find the `Screen` enum and add `ADMIN_NOTIFICATIONS`:
```ts
export enum Screen {
  DASHBOARD = 'DASHBOARD',
  AUDIT_DETAILS = 'AUDIT_DETAILS',
  TRAINING_PLAN = 'TRAINING_PLAN',
  QUIZ = 'QUIZ',
  PROGRESS = 'PROGRESS',
  ADMIN_USERS = 'ADMIN_USERS',
  ADMIN_REPORTS = 'ADMIN_REPORTS',
  ADMIN_REPORTS_LIST = 'ADMIN_REPORTS_LIST',
  ADMIN_NOTIFICATIONS = 'ADMIN_NOTIFICATIONS',
  MY_REPORTS = 'MY_REPORTS',
}
```

- [ ] **Step 2: Add notification interfaces to `frontend/src/types.ts`**

Append at the end of `types.ts`:
```ts
export type NotificationType = 'reflection_submitted' | 'plan_generated' | 'plan_completed';
export type SystemLogType = 'login_success' | 'login_failed';

export interface AdminNotification {
  _id: string;
  type: NotificationType;
  userId: string;
  reportId: string;
  userName: string;
  reportFileName: string;
  isOnTime: boolean | null;
  isRead: boolean;
  createdAt: string;
}

export interface SystemLogEntry {
  _id: string;
  type: SystemLogType;
  phone: string;
  userName: string | null;
  ip: string | null;
  isRead: boolean;
  createdAt: string;
}
```

- [ ] **Step 3: Add `timeAgo` to `frontend/src/utils/dateFormatter.ts`**

Append to the existing file (keep `formatDate` as-is):
```ts
export const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'щойно';
  if (mins < 60) return `${mins} хв тому`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.floor(hours / 24);
  return `${days} дн тому`;
};

export const formatAbsDateTime = (dateStr: string): string =>
  new Date(dateStr).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
```

- [ ] **Step 4: Create `frontend/src/services/notificationsService.ts`**

```ts
import { AdminNotification, SystemLogEntry } from '../types';

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('kameya_token') ?? ''}`,
});

export const getNotifications = async (): Promise<AdminNotification[]> => {
  const res = await fetch('/api/notifications', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження сповіщень');
  return res.json();
};

export const getUnreadCount = async (): Promise<number> => {
  const res = await fetch('/api/notifications/unread-count', { headers: getAuthHeaders() });
  if (!res.ok) return 0;
  const data: { count: number } = await res.json();
  return data.count;
};

export const markNotificationRead = async (id: string): Promise<AdminNotification> => {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Помилка оновлення сповіщення');
  return res.json();
};

export const getSystemLogs = async (): Promise<SystemLogEntry[]> => {
  const res = await fetch('/api/notifications/system', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження логів');
  return res.json();
};

export const getSystemUnreadCount = async (): Promise<number> => {
  const res = await fetch('/api/notifications/system/unread-count', { headers: getAuthHeaders() });
  if (!res.ok) return 0;
  const data: { count: number } = await res.json();
  return data.count;
};

export const markSystemLogRead = async (id: string): Promise<SystemLogEntry> => {
  const res = await fetch(`/api/notifications/system/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Помилка оновлення логу');
  return res.json();
};
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/utils/dateFormatter.ts frontend/src/services/notificationsService.ts
git commit -m "feat: add AdminNotification types and notificationsService"
```

---

### Task 6: Frontend — AdminNotificationsView component

**Files:**
- Create: `frontend/src/components/admin/AdminNotificationsView.tsx`

**Interfaces:**
- Consumes:
  - `AdminNotification` from `../../types`
  - `getNotifications`, `markNotificationRead` from `../../services/notificationsService`
  - `timeAgo`, `formatAbsDateTime` from `../../utils/dateFormatter`
- Produces:
  - `AdminNotificationsView` component with props:
    - `onViewReport: (reportId: string) => void`
    - `onMarkReadDecrement: () => void`

- [ ] **Step 1: Create `frontend/src/components/admin/AdminNotificationsView.tsx`**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { AdminNotification } from '../../types';
import { getNotifications, markNotificationRead } from '../../services/notificationsService';
import { timeAgo, formatAbsDateTime } from '../../utils/dateFormatter';

const TYPE_CONFIG = {
  reflection_submitted: {
    icon: 'fa-comment-dots',
    color: 'text-blue-500',
    bg: 'bg-blue-100',
    verb: 'подав(ла) рефлексію до звіту',
  },
  plan_generated: {
    icon: 'fa-graduation-cap',
    color: 'text-amber-500',
    bg: 'bg-amber-100',
    verb: 'згенерував(ла) план навчання до звіту',
  },
  plan_completed: {
    icon: 'fa-circle-check',
    color: 'text-green-500',
    bg: 'bg-green-100',
    verb: 'завершив(ла) план навчання до звіту',
  },
} as const;

interface AdminNotificationsViewProps {
  onViewReport: (reportId: string) => void;
  onMarkReadDecrement: () => void;
}

export const AdminNotificationsView: React.FC<AdminNotificationsViewProps> = ({
  onViewReport,
  onMarkReadDecrement,
}) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getNotifications()
      .then(setNotifications)
      .catch(() => setError('Помилка завантаження сповіщень'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleView = async (n: AdminNotification) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n._id);
        setNotifications(prev =>
          prev.map(x => x._id === n._id ? { ...x, isRead: true } : x)
        );
        onMarkReadDecrement();
      } catch {
        // non-blocking — navigate regardless
      }
    }
    onViewReport(n.reportId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Сповіщення</h2>
          <p className="text-slate-500 mt-1">Активність працівників</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <i className="fas fa-rotate-right"></i>
          Оновити
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <i className="fas fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-slate-100 h-20" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <i className="fas fa-bell-slash text-4xl mb-4 block"></i>
          <p className="text-lg font-medium">Немає сповіщень</p>
          <p className="text-sm mt-1">Активність з'явиться після нових дій працівників</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type];
            return (
              <div
                key={n._id}
                className={`bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4 transition-colors ${
                  !n.isRead
                    ? 'border-l-4 border-l-kameya-burgundy border border-slate-100'
                    : 'border border-slate-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                  <i className={`fas ${cfg.icon} ${cfg.color}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold">{n.userName}</span>
                    {' '}{cfg.verb}{' '}
                    <span className="font-medium text-slate-600">{n.reportFileName || 'звіт'}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400" title={formatAbsDateTime(n.createdAt)}>
                      {timeAgo(n.createdAt)}
                    </span>
                    {n.isOnTime !== null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        n.isOnTime ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {n.isOnTime ? 'Вчасно' : 'Запізно'}
                      </span>
                    )}
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-kameya-burgundy flex-shrink-0" />
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleView(n)}
                  className="flex-shrink-0 px-4 py-2 rounded-lg bg-kameya-burgundy text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Переглянути
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/AdminNotificationsView.tsx
git commit -m "feat: add AdminNotificationsView component"
```

---

### Task 7: Frontend — SystemNotificationsPanel component

**Files:**
- Create: `frontend/src/components/admin/SystemNotificationsPanel.tsx`

**Interfaces:**
- Consumes:
  - `SystemLogEntry` from `../../types`
  - `getSystemLogs`, `markSystemLogRead` from `../../services/notificationsService`
  - `timeAgo`, `formatAbsDateTime` from `../../utils/dateFormatter`
- Produces:
  - `SystemNotificationsPanel` component with props:
    - `open: boolean`
    - `onClose: () => void`
    - `onMarkReadDecrement: () => void`

- [ ] **Step 1: Create `frontend/src/components/admin/SystemNotificationsPanel.tsx`**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { SystemLogEntry } from '../../types';
import { getSystemLogs, markSystemLogRead } from '../../services/notificationsService';
import { timeAgo, formatAbsDateTime } from '../../utils/dateFormatter';

interface SystemNotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onMarkReadDecrement: () => void;
}

export const SystemNotificationsPanel: React.FC<SystemNotificationsPanelProps> = ({
  open,
  onClose,
  onMarkReadDecrement,
}) => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getSystemLogs()
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleClick = async (log: SystemLogEntry) => {
    if (log.isRead) return;
    try {
      await markSystemLogRead(log._id);
      setLogs(prev => prev.map(x => x._id === log._id ? { ...x, isRead: true } : x));
      onMarkReadDecrement();
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <i className="fas fa-shield-halved text-kameya-burgundy"></i>
            <h3 className="text-lg font-bold text-slate-800">Системні сповіщення</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
          >
            <i className="fas fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-16" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <i className="fas fa-shield-halved text-3xl mb-3 block"></i>
              <p className="text-sm">Немає системних подій</p>
            </div>
          ) : (
            logs.map(log => (
              <button
                key={log._id}
                onClick={() => handleClick(log)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  !log.isRead
                    ? 'border-l-4 border-l-kameya-burgundy border-slate-100 bg-slate-50'
                    : 'border-slate-100 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    log.type === 'login_success' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <i className={`fas text-xs ${
                      log.type === 'login_success'
                        ? 'fa-circle-check text-green-600'
                        : 'fa-circle-xmark text-red-600'
                    }`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {log.userName ?? log.phone}
                    </p>
                    <p className="text-xs text-slate-500">
                      {log.type === 'login_success' ? 'Успішний вхід' : 'Невірний пароль'}
                      {log.userName && (
                        <span className="text-slate-400 ml-1">· {log.phone}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5" title={formatAbsDateTime(log.createdAt)}>
                      {timeAgo(log.createdAt)}
                    </p>
                  </div>
                  {!log.isRead && (
                    <div className="w-2 h-2 rounded-full bg-kameya-burgundy mt-1 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/SystemNotificationsPanel.tsx
git commit -m "feat: add SystemNotificationsPanel slide-over component"
```

---

### Task 8: Frontend — Layout + App wiring + AdminReportsListView initialReportId

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

**Interfaces:**
- Consumes: all components and types from previous tasks
- Produces: fully wired admin notifications feature visible in the app

- [ ] **Step 1: Update `frontend/src/components/Layout.tsx`**

Replace the entire file with:

```tsx
import React from 'react';
import { Screen, AuthUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  user: AuthUser;
  onLogout: () => void;
  notificationsUnread?: number;
  systemUnread?: number;
  onOpenSystemPanel?: () => void;
}

const ADMIN_NAV = [
  { id: Screen.DASHBOARD,            label: 'Дашборд',             icon: 'fa-house' },
  { id: Screen.ADMIN_USERS,          label: 'Користувачі',         icon: 'fa-users' },
  { id: Screen.ADMIN_REPORTS,        label: 'Завантаження звітів', icon: 'fa-file-arrow-up' },
  { id: Screen.ADMIN_REPORTS_LIST,   label: 'Всі звіти',           icon: 'fa-list-check' },
  { id: Screen.ADMIN_NOTIFICATIONS,  label: 'Сповіщення',          icon: 'fa-bell' },
];

const EMPLOYEE_NAV = [
  { id: Screen.DASHBOARD,     label: 'Дашборд',       icon: 'fa-house' },
  { id: Screen.MY_REPORTS,    label: 'Мої звіти',     icon: 'fa-magnifying-glass' },
  { id: Screen.TRAINING_PLAN, label: 'План розвитку', icon: 'fa-graduation-cap' },
  { id: Screen.PROGRESS,      label: 'Мій прогрес',   icon: 'fa-trophy' },
];

const Badge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeScreen,
  onNavigate,
  user,
  onLogout,
  notificationsUnread = 0,
  systemUnread = 0,
  onOpenSystemPanel,
}) => {
  const isAdmin = user.role === 'ADMIN';
  const navItems = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar для десктопу */}
      <aside className="hidden md:flex flex-col w-64 bg-kameya-burgundy text-white shadow-xl sticky top-0 h-screen">
        <div className="p-2 border-b border-white/20">
          <img src="/LogoLight.png" alt="Kameya Academy" className="w-full" />
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeScreen === item.id ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
              }`}
            >
              <i className={`fas ${item.icon} w-4 text-center`}></i>
              <span>{item.label}</span>
              {item.id === Screen.ADMIN_NOTIFICATIONS && (
                <Badge count={notificationsUnread} />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/20 bg-black/10">
          {isAdmin && onOpenSystemPanel && (
            <button
              onClick={onOpenSystemPanel}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors mb-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <i className="fas fa-shield-halved w-4 text-center"></i>
                <span>Системні сповіщення</span>
              </div>
              {systemUnread > 0 && (
                <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center leading-none">
                  {systemUnread > 99 ? '99+' : systemUnread}
                </span>
              )}
            </button>
          )}

          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(user.name || user.phone).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user.name || user.phone}</p>
              <p className="text-xs opacity-60 truncate">
                {user.role === 'ADMIN' ? 'Адміністратор' : (user.position ?? user.phone)}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full text-xs text-white/60 hover:text-white/90 py-2 rounded-lg hover:bg-white/10 transition-colors text-left px-2 flex items-center space-x-2"
          >
            <i className="fas fa-right-from-bracket"></i>
            <span>Вийти</span>
          </button>
        </div>
      </aside>

      {/* Мобільна нижня навігація */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`relative p-3 rounded-full ${
              activeScreen === item.id ? 'text-kameya-burgundy bg-red-50' : 'text-gray-400'
            }`}
          >
            <i className={`fas ${item.icon} text-lg`}></i>
            {item.id === Screen.ADMIN_NOTIFICATIONS && notificationsUnread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {notificationsUnread > 99 ? '99+' : notificationsUnread}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <header className="bg-white border-b p-4 px-6 sticky top-0 z-10 flex justify-between items-center md:hidden">
          <img src="/LogoBordo.png" alt="Kameya Academy" className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            {isAdmin && onOpenSystemPanel && (
              <button
                onClick={onOpenSystemPanel}
                className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600"
              >
                <i className="fas fa-shield-halved text-sm"></i>
                {systemUnread > 0 && (
                  <span className="absolute top-0 right-0 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {systemUnread > 9 ? '9+' : systemUnread}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-full bg-kameya-burgundy text-white flex items-center justify-center text-xs font-bold"
              title="Вийти"
            >
              {(user.name || user.phone).charAt(0).toUpperCase()}
            </button>
          </div>
        </header>
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
};
```

- [ ] **Step 2: Add `initialReportId` prop support to `AdminReportsListView.tsx`**

At the top of the file, change the component signature from:
```tsx
export const AdminReportsListView: React.FC = () => {
```
to:
```tsx
interface AdminReportsListViewProps {
  initialReportId?: string | null;
}

export const AdminReportsListView: React.FC<AdminReportsListViewProps> = ({ initialReportId }) => {
```

Then add this `useEffect` right after the existing state declarations (after `const [groupMode, ...]` and before `const toggleGroup`):
```tsx
  useEffect(() => {
    if (!initialReportId || !reports.length) return;
    const target = reports.find(r => (r._id ?? r.id) === initialReportId);
    if (target) setSelected(target as ReportWithUser);
  }, [initialReportId, reports]);
```

- [ ] **Step 3: Update `frontend/src/App.tsx`**

Replace the entire file with:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TrainingPlanView } from './components/TrainingPlanView';
import { DevelopmentPlanView } from './components/employee/DevelopmentPlanView';
import { QuizView } from './components/QuizView';
import { ProgressView } from './components/ProgressView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UsersView } from './components/admin/UsersView';
import { ReportsUploadView } from './components/admin/ReportsUploadView';
import { AdminReportsListView } from './components/admin/AdminReportsListView';
import { AdminNotificationsView } from './components/admin/AdminNotificationsView';
import { SystemNotificationsPanel } from './components/admin/SystemNotificationsPanel';
import { MyReportsView } from './components/employee/MyReportsView';
import { LoginPage } from './pages/LoginPage';
import { Screen, AIAnalysisResult, AuditResult, QuizQuestion } from './types';
import { MOCK_AUDIT } from './constants';
import { analyzeAuditResult, generateQuizQuestions } from './services/geminiService';
import { getUnreadCount, getSystemUnreadCount } from './services/notificationsService';

const AppContent: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.DASHBOARD);
  const [selectedAudit, setSelectedAudit] = useState<AuditResult | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<{ topic: string; questions: QuizQuestion[] } | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Notifications state (admin only)
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [systemUnread, setSystemUnread] = useState(0);
  const [systemPanelOpen, setSystemPanelOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    const savedAnalysis = localStorage.getItem('kameya_analysis');
    if (savedAnalysis) {
      try { setAnalysis(JSON.parse(savedAnalysis)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (analysis) localStorage.setItem('kameya_analysis', JSON.stringify(analysis));
  }, [analysis]);

  const refreshUnreadCounts = useCallback(() => {
    if (!isAdmin) return;
    getUnreadCount().then(setNotificationsUnread).catch(() => {});
    getSystemUnreadCount().then(setSystemUnread).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    refreshUnreadCounts();
    const interval = setInterval(refreshUnreadCounts, 60000);
    return () => clearInterval(interval);
  }, [isAdmin, refreshUnreadCounts]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleNavigate = (screen: Screen) => {
    setSelectedAudit(null);
    if (screen !== Screen.ADMIN_REPORTS_LIST) setSelectedReportId(null);
    setCurrentScreen(screen);
  };

  const handleNavigateToAuditDetails = (audit: AuditResult) => {
    setSelectedAudit(audit);
    setCurrentScreen(Screen.MY_REPORTS);
  };

  const handleViewReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setCurrentScreen(Screen.ADMIN_REPORTS_LIST);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy"></i>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const renderAdminScreen = () => {
    switch (currentScreen) {
      case Screen.ADMIN_USERS:
        return <UsersView />;
      case Screen.ADMIN_REPORTS:
        return <ReportsUploadView />;
      case Screen.ADMIN_REPORTS_LIST:
        return <AdminReportsListView initialReportId={selectedReportId} />;
      case Screen.ADMIN_NOTIFICATIONS:
        return (
          <AdminNotificationsView
            onViewReport={handleViewReport}
            onMarkReadDecrement={() => setNotificationsUnread(c => Math.max(0, c - 1))}
          />
        );
      default:
        return <AdminDashboard />;
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeAuditResult(MOCK_AUDIT);
      setAnalysis(result);
      setCurrentScreen(Screen.TRAINING_PLAN);
      showToast('Аналіз завершено успішно!');
    } catch { alert('Помилка при аналізі AI.'); }
    finally { setIsAnalyzing(false); }
  };

  const handleStartQuiz = async (topic: string) => {
    setIsGeneratingQuiz(true);
    try {
      const questions = await generateQuizQuestions(topic);
      setActiveQuiz({ topic, questions });
      setCurrentScreen(Screen.QUIZ);
    } catch { alert('Помилка при генерації тесту.'); }
    finally { setIsGeneratingQuiz(false); }
  };

  const handleShare = async () => {
    const shareText = `Мій результат у Kameya Academy: ${MOCK_AUDIT.totalScore}%\nПосада: ${user.position ?? ''}\nКрокуємо до досконалості разом!`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Kameya Academy', text: shareText, url: window.location.href }); }
      catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('Результат скопійовано у буфер обміну!');
    }
  };

  const renderEmployeeScreen = () => {
    switch (currentScreen) {
      case Screen.MY_REPORTS:
        return <MyReportsView initialSelected={selectedAudit} onNavigate={handleNavigate} />;
      case Screen.TRAINING_PLAN:
        return <DevelopmentPlanView />;
      case Screen.QUIZ:
        return activeQuiz ? (
          <QuizView topic={activeQuiz.topic} questions={activeQuiz.questions} onFinish={() => {
            setCurrentScreen(Screen.TRAINING_PLAN);
            showToast('Тест пройдено! Прогрес оновлено.');
          }} />
        ) : null;
      case Screen.PROGRESS:
        return <ProgressView />;
      default:
        return <Dashboard onNavigate={handleNavigate} onNavigateToAuditDetails={handleNavigateToAuditDetails} />;
    }
  };

  return (
    <Layout
      activeScreen={currentScreen}
      onNavigate={handleNavigate}
      user={user}
      onLogout={logout}
      notificationsUnread={notificationsUnread}
      systemUnread={systemUnread}
      onOpenSystemPanel={() => setSystemPanelOpen(true)}
    >
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl animate-bounce-in flex items-center space-x-2">
          <i className="fas fa-circle-check text-green-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {isGeneratingQuiz && (
        <div className="fixed inset-0 bg-kameya-burgundy/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center space-y-4 max-w-sm">
            <i className="fas fa-spinner fa-spin text-4xl text-kameya-burgundy"></i>
            <h3 className="text-xl font-bold text-slate-800">Генерація тесту...</h3>
            <p className="text-sm text-slate-500">AI створює практичні запитання на основі ваших слабких місць.</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <SystemNotificationsPanel
          open={systemPanelOpen}
          onClose={() => setSystemPanelOpen(false)}
          onMarkReadDecrement={() => setSystemUnread(c => Math.max(0, c - 1))}
        />
      )}

      {isAdmin ? renderAdminScreen() : renderEmployeeScreen()}

      <style>{`
        @keyframes bounce-in {
          0% { transform: translateY(-20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.3s ease-out; }
      `}</style>
    </Layout>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run the app and verify end-to-end**

Start both servers:
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Checklist to verify:
- [ ] Log in as admin → sidebar shows "Сповіщення" item with bell icon
- [ ] No badge when count is 0
- [ ] Click "Системні сповіщення" in sidebar → panel slides in from right
- [ ] Login events appear in system panel (log in as employee in another browser tab)
- [ ] Clicking a system log entry marks it read (dot disappears, border removes)
- [ ] System badge count decrements after mark-read
- [ ] ESC key closes system panel; backdrop click also closes it
- [ ] As employee, submit a reflection → as admin go to Сповіщення → notification appears
- [ ] "Вчасно" / "Запізно" badge shows correctly
- [ ] Click "Переглянути" → navigates to Всі звіти with that report auto-selected and highlighted
- [ ] Notification badge on menu updates after mark-read
- [ ] As employee, generate a learning plan → plan_generated notification appears for admin
- [ ] As employee, complete all learning plan tasks → plan_completed notification appears

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Layout.tsx \
        frontend/src/App.tsx \
        frontend/src/components/admin/AdminReportsListView.tsx
git commit -m "feat: wire notifications into Layout and App, add initialReportId to AdminReportsListView"
```
