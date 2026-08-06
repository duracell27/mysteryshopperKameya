# Avatar Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to upload a photo for any user; display it in the admin table, edit modal, and the user's own Layout header.

**Architecture:** Multer saves images to `uploads/avatars/<userId>.<ext>` on disk (same pattern as audio). `avatarUrl` (relative path like `/uploads/avatars/abc.jpg`) is stored on the User document and included in JWT/login response. Vite proxies `/uploads` to the backend so the frontend uses relative URLs.

**Tech Stack:** Express, Multer, Mongoose, React, TypeScript, Tailwind CSS

## Global Constraints

- No new npm packages — multer is already installed
- No `any`, no ts-ignore
- Avatar URL stored as relative path: `/uploads/avatars/<filename>` (not absolute)
- Max file size: 2MB; accepted types: `image/*` only
- Filename on disk: `<userId>.<ext>` (overwrites previous avatar for same user)
- All UI strings in Ukrainian
- Vite proxy covers both `/api` and `/uploads`

---

### Task 1: Backend — model, directory, static serving

**Files:**
- Modify: `backend/src/models/User.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Produces: `IUser.avatarUrl?: string` — used by Tasks 2, 3

- [ ] **Step 1: Add `avatarUrl` to User model**

In `backend/src/models/User.ts`, add to `IUser` interface after `position`:
```typescript
avatarUrl?: string;
```

Add to `UserSchema` after the `position` field:
```typescript
avatarUrl: { type: String },
```

- [ ] **Step 2: Create avatars directory and serve static files in `backend/src/index.ts`**

After the existing `fs.mkdirSync` line for audio (line 17), add:
```typescript
fs.mkdirSync(path.join(process.cwd(), 'uploads', 'avatars'), { recursive: true });
```

After the existing Express middleware setup (find where `app.use(express.json())` or routes are registered), add before any route registrations:
```typescript
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/User.ts backend/src/index.ts
git commit -m "feat: add avatarUrl to User model and serve uploads/avatars statically"
```

---

### Task 2: Backend — avatar upload endpoint

**Files:**
- Modify: `backend/src/routes/users.ts`

**Interfaces:**
- Consumes: `IUser.avatarUrl` from Task 1; `AuthRequest` (already has `isAdmin`)
- Produces: `POST /api/users/:id/avatar` → `{ avatarUrl: string }` — used by Task 5

- [ ] **Step 1: Add multer import and avatar storage config at the top of `backend/src/routes/users.ts`**

After the existing imports, add:
```typescript
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, _file, cb) => {
    const ext = _file.mimetype.split('/')[1].replace('jpeg', 'jpg');
    cb(null, `${(req as AuthRequest).params?.id}.${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Тільки зображення'));
  },
});
```

- [ ] **Step 2: Add the upload endpoint before `router.delete('/:id')`**

```typescript
// POST /api/users/:id/avatar — upload avatar for a user (admin only)
router.post('/:id/avatar', (req: AuthRequest, res: Response) => {
  avatarUpload.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не завантажено' });
    }
    try {
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { avatarUrl },
        { new: true, select: '-password' }
      );
      if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
      return res.json({ avatarUrl });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Помилка сервера' });
    }
  });
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Manual smoke test**

Start backend: `npm run dev`

```bash
# Upload a test image (replace USER_ID and TOKEN with real values)
curl -X POST http://localhost:3001/api/users/USER_ID/avatar \
  -H "Authorization: Bearer TOKEN" \
  -F "avatar=@/path/to/test.jpg"
# Expected: { "avatarUrl": "/uploads/avatars/USER_ID.jpg" }

# Verify file is served
curl -I http://localhost:3001/uploads/avatars/USER_ID.jpg
# Expected: 200 OK
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/users.ts
git commit -m "feat: add POST /api/users/:id/avatar endpoint"
```

---

### Task 3: Backend — include avatarUrl in auth (JWT + login response)

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/auth.ts` (login handler only)

**Interfaces:**
- Consumes: `IUser.avatarUrl` from Task 1
- Produces: JWT payload includes `avatarUrl?: string`; login response includes `avatarUrl?: string` — used by Task 4

- [ ] **Step 1: Add `avatarUrl` to AuthRequest in `backend/src/middleware/auth.ts`**

In the `AuthRequest` interface, add after `position`:
```typescript
avatarUrl?: string;
```

In the JWT decoded type (the `as { ... }` cast inside `authMiddleware`), add:
```typescript
avatarUrl?: string;
```

- [ ] **Step 2: Update login JWT sign in `backend/src/routes/auth.ts`**

In the `jwt.sign(...)` call inside the `/login` POST handler, add `avatarUrl`:
```typescript
const token = jwt.sign(
  {
    userId:    user._id,
    phone:     user.phone,
    isAdmin:   user.isAdmin,
    division:  user.division,
    group:     user.group,
    position:  user.position,
    avatarUrl: user.avatarUrl ?? null,
  },
  process.env.JWT_SECRET || 'fallback-secret',
  { expiresIn: '7d' }
);
```

In the `return res.json({ token, user: { ... } })` block, add:
```typescript
avatarUrl: user.avatarUrl ?? null,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/routes/auth.ts
git commit -m "feat: include avatarUrl in JWT payload and login response"
```

---

### Task 4: Frontend — types, proxy, service

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/services/usersService.ts`

**Interfaces:**
- Consumes: `/uploads/avatars/` static path from Task 1; login `avatarUrl` from Task 3
- Produces: `AuthUser.avatarUrl?: string | null`, `UserListItem.avatarUrl?: string | null`, `uploadAvatar(id, file)` — used by Tasks 5, 6

- [ ] **Step 1: Add `avatarUrl` to types in `frontend/src/types.ts`**

In `AuthUser` interface, add after `position`:
```typescript
avatarUrl?: string | null;
```

In `UserListItem` interface, add after `position`:
```typescript
avatarUrl?: string | null;
```

- [ ] **Step 2: Add `/uploads` proxy in `frontend/vite.config.ts`**

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Add `uploadAvatar` function to `frontend/src/services/usersService.ts`**

```typescript
export const uploadAvatar = async (userId: string, file: File): Promise<{ avatarUrl: string }> => {
  const form = new FormData();
  form.append('avatar', file);
  const res = await apiFetch(`/api/users/${userId}/avatar`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Помилка завантаження');
  }
  return res.json();
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: errors in Layout.tsx and UsersView.tsx (not yet consuming avatarUrl) — that is fine.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/vite.config.ts frontend/src/services/usersService.ts
git commit -m "feat: add avatarUrl to frontend types, proxy /uploads, add uploadAvatar service"
```

---

### Task 5: Frontend — Layout header avatar

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `AuthUser.avatarUrl?: string | null` from Task 4

- [ ] **Step 1: Create avatar helper component inline in Layout.tsx**

At the top of the component body (before the return), add:

```typescript
const AvatarCircle: React.FC<{ avatarUrl?: string | null; name: string; phone: string; size: 'sm' | 'md' }> = ({ avatarUrl, name, phone, size }) => {
  const dim = size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const initial = (name || phone).charAt(0).toUpperCase();
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${dim} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-white/20 flex items-center justify-center font-bold flex-shrink-0`}>
      {initial}
    </div>
  );
};
```

- [ ] **Step 2: Replace sidebar avatar (lines ~110-113)**

Find:
```tsx
<div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
  {(user.name || user.phone).charAt(0).toUpperCase()}
</div>
```

Replace with:
```tsx
<AvatarCircle avatarUrl={user.avatarUrl} name={user.name} phone={user.phone} size="md" />
```

- [ ] **Step 3: Replace topbar avatar button (lines ~178-183)**

Find:
```tsx
<button
  onClick={() => setUserMenuOpen((v) => !v)}
  className="w-8 h-8 rounded-full bg-kameya-burgundy text-white flex items-center justify-center text-xs font-bold"
>
  {(user.name || user.phone).charAt(0).toUpperCase()}
</button>
```

Replace with:
```tsx
<button
  onClick={() => setUserMenuOpen((v) => !v)}
  className="w-8 h-8 rounded-full bg-kameya-burgundy text-white flex items-center justify-center text-xs font-bold overflow-hidden"
>
  <AvatarCircle avatarUrl={user.avatarUrl} name={user.name} phone={user.phone} size="sm" />
</button>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors in Layout.tsx

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: show avatar in Layout header sidebar and topbar"
```

---

### Task 6: Frontend — UsersView avatar upload

**Files:**
- Modify: `frontend/src/components/admin/UsersView.tsx`

**Interfaces:**
- Consumes: `UserListItem.avatarUrl` from Task 4; `uploadAvatar(userId, file)` from Task 4

- [ ] **Step 1: Add import for `uploadAvatar` in UsersView.tsx**

In the existing import from `../../services/usersService`, add `uploadAvatar`:
```typescript
import { fetchUsers, createUser, updateUser, deleteUser, CreateUserPayload, UpdateUserPayload, getUserPointsHistory, uploadAvatar } from '../../services/usersService';
```

- [ ] **Step 2: Add avatar upload handler**

Inside the `UsersView` component, add after the existing state declarations:
```typescript
const handleAvatarUpload = async (userId: string, file: File) => {
  try {
    const { avatarUrl } = await uploadAvatar(userId, file);
    setUsers(prev => prev.map(u => u._id === userId ? { ...u, avatarUrl } : u));
  } catch (err) {
    console.error('Avatar upload failed:', err);
  }
};
```

- [ ] **Step 3: Add avatar in table row — replace the name cell**

Find the table row name cell:
```tsx
<td className="px-6 py-4">
  <p className="font-medium text-slate-800">{u.name || '—'}</p>
  <p className="text-slate-400 text-xs mt-0.5">{toDisplay(u.phone)}</p>
</td>
```

Replace with:
```tsx
<td className="px-6 py-4">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0 overflow-hidden">
      {u.avatarUrl
        ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
        : (u.name || u.phone).charAt(0).toUpperCase()
      }
    </div>
    <div>
      <p className="font-medium text-slate-800">{u.name || '—'}</p>
      <p className="text-slate-400 text-xs mt-0.5">{toDisplay(u.phone)}</p>
    </div>
  </div>
</td>
```

- [ ] **Step 4: Add avatar upload in edit modal**

In the edit modal, find the first input field (name). Before it, add an avatar preview + upload button:

```tsx
{/* Avatar upload */}
<div className="flex flex-col items-center gap-2 pb-2">
  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500 overflow-hidden">
    {editUser?.avatarUrl
      ? <img src={editUser.avatarUrl} alt={editUser.name} className="w-full h-full object-cover" />
      : (editUser?.name || editUser?.phone || '?').charAt(0).toUpperCase()
    }
  </div>
  <label className="cursor-pointer text-xs text-kameya-burgundy hover:opacity-75 transition-opacity">
    Змінити фото
    <input
      type="file"
      accept="image/*"
      className="hidden"
      onChange={e => {
        const file = e.target.files?.[0];
        if (file && editUser) handleAvatarUpload(editUser._id, file);
      }}
    />
  </label>
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Manual end-to-end test**

1. Open admin panel → Users
2. Click edit on any user
3. Click "Змінити фото" → select an image ≤2MB
4. Avatar updates immediately in the modal
5. Close modal — avatar shows in the table row
6. Log in as that user — avatar shows in Layout header (both sidebar and topbar)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/UsersView.tsx
git commit -m "feat: avatar upload in UsersView table and edit modal"
```
