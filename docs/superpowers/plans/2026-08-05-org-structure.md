# Org Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `role`/`store` user fields with a 3-level org hierarchy (Division → Group → Position) and convert ADMIN from an enum value to a boolean flag.

**Architecture:** A single `org-structure.ts` constants file is the source of truth for all divisions, groups, and positions. The User model drops `role` and `store`, gaining `isAdmin`, `division`, and `group`. All role checks in middleware, routes, and frontend swap `role === 'ADMIN'` for `isAdmin`. A one-time migration script handles existing data.

**Tech Stack:** TypeScript, Express, Mongoose (MongoDB), React + Vite, Tailwind CSS

## Global Constraints

- No new npm packages — use only what's already installed
- TypeScript strict mode — no `any`, no ts-ignore
- Phone format: stored as `0XXXXXXXXX` (normalized before save)
- All Ukrainian UI strings remain in Ukrainian
- No changes to Report model or visibility rules (each user sees their own, admin sees all)

---

### Task 1: Org structure constants

**Files:**
- Create: `backend/src/config/org-structure.ts`
- Create: `frontend/src/config/org-structure.ts` (identical copy)

**Interfaces:**
- Produces: `ORG_STRUCTURE`, `Division`, `Group<D>`, `getLabel(division, group)` — used by Tasks 3, 4, 7, 8

- [ ] **Step 1: Create backend constants file**

```typescript
// backend/src/config/org-structure.ts

export const ORG_STRUCTURE = {
  stores: {
    label: 'Магазини',
    groups: {
      store_1:  'Арсен',
      store_2:  'Бельведерська',
      store_3:  'Галицька',
      store_4:  'Галич',
      store_5:  'Коломия',
      store_6:  'Надвірна золото',
      store_7:  'Надвірна срібло',
      store_8:  'Цум',
      store_9:  'Шашкевича',
      store_10: 'Шпитальна',
      store_11: 'Магазин 11',
    },
    positions: ['Керівник', 'Консультант', 'Початківець консультант'],
  },
  office: {
    label: 'Офіс',
    groups: {
      marketing:  'Маркетинг',
      accounting: 'Бухгалтерія',
      supply:     'Постачання',
      hr:         'HR',
      it:         'IT',
      management: 'Керівник',
    },
    positions: ['Співробітник', 'Керівник'],
  },
  security: {
    label: 'Охорона',
    groups: {
      staff:      'Охоронці',
      management: 'Керівник',
    },
    positions: ['Охоронець', 'Керівник'],
  },
} as const;

export type Division = keyof typeof ORG_STRUCTURE;
export type GroupKey<D extends Division> = keyof typeof ORG_STRUCTURE[D]['groups'];

export function getDivisionLabel(division: string): string {
  return (ORG_STRUCTURE as Record<string, { label: string }>)[division]?.label ?? division;
}

export function getGroupLabel(division: string, group: string): string {
  const groups = (ORG_STRUCTURE as Record<string, { groups: Record<string, string> }>)[division]?.groups;
  return groups?.[group] ?? group;
}

export function isValidOrg(division: string, group: string, position: string): boolean {
  const div = (ORG_STRUCTURE as Record<string, { groups: Record<string, string>; positions: readonly string[] }>)[division];
  if (!div) return false;
  if (!div.groups[group]) return false;
  if (!div.positions.includes(position)) return false;
  return true;
}
```

- [ ] **Step 2: Copy identical file to frontend**

Create `frontend/src/config/org-structure.ts` with the exact same content as above.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/config/org-structure.ts frontend/src/config/org-structure.ts
git commit -m "feat: add org-structure constants (divisions, groups, positions)"
```

---

### Task 2: Update User model

**Files:**
- Modify: `backend/src/models/User.ts`

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces: `IUser` with `isAdmin`, `division`, `group`, `position` — used by Tasks 3, 4, 5

- [ ] **Step 1: Replace the file content**

```typescript
// backend/src/models/User.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBadgeAward {
  _id: Types.ObjectId;
  badgeId: string;
  earnedAt: Date;
  year?: number;
  manual?: boolean;
}

export interface IUser extends Document {
  phone: string;
  password: string;
  name: string;
  isAdmin: boolean;
  division: string;
  group: string;
  position: string;
  points: number;
  birthday?: Date;
  badges: IBadgeAward[];
  createdAt: Date;
  updatedAt: Date;
}

const BadgeAwardSchema = new Schema<IBadgeAward>({
  badgeId:  { type: String, required: true },
  earnedAt: { type: Date, required: true, default: Date.now },
  year:     { type: Number },
  manual:   { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>(
  {
    phone:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name:     { type: String, default: '' },
    isAdmin:  { type: Boolean, default: false },
    division: { type: String, default: '' },
    group:    { type: String, default: '' },
    position: { type: String, default: '' },
    points:   { type: Number, default: 0 },
    birthday: { type: Date },
    badges:   { type: [BadgeAwardSchema], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: errors only in files that still reference `user.role` or `user.store` — those are fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/User.ts
git commit -m "feat: update User model — isAdmin + division/group/position, drop role/store"
```

---

### Task 3: Update auth middleware and login route

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/auth.ts` (login endpoint only — lines 66–86)

**Interfaces:**
- Consumes: `IUser.isAdmin`, `IUser.division`, `IUser.group`, `IUser.position` from Task 2
- Produces: `AuthRequest.user` with `{ userId, phone, isAdmin, division, group, position }` — used by Task 4

- [ ] **Step 1: Replace auth middleware**

```typescript
// backend/src/middleware/auth.ts
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
    ) as { userId: string; phone: string; isAdmin: boolean; division: string; group: string; position: string };

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Невалідний токен' });
  }
};
```

- [ ] **Step 2: Update login JWT sign and response in `backend/src/routes/auth.ts`**

Find the block starting with `const token = jwt.sign(` (line 66) and replace through the `return res.json({` block (line 86):

```typescript
    const token = jwt.sign(
      {
        userId:   user._id,
        phone:    user.phone,
        isAdmin:  user.isAdmin,
        division: user.division,
        group:    user.group,
        position: user.position,
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    SystemLog.create({ type: 'login_success', phone: normalizedPhone, userName: user.name || null, ip })
      .catch(() => {});

    return res.json({
      token,
      user: {
        id:       user._id,
        phone:    user.phone,
        name:     user.name,
        isAdmin:  user.isAdmin,
        division: user.division,
        group:    user.group,
        position: user.position,
        points:   user.points ?? 0,
      },
    });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: errors only in `routes/users.ts` — fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/routes/auth.ts
git commit -m "feat: update JWT payload and login response to use isAdmin + org fields"
```

---

### Task 4: Update backend user routes and seed

**Files:**
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/src/seed.ts`

**Interfaces:**
- Consumes: `AuthRequest.user.isAdmin` from Task 3; `isValidOrg` from Task 1; `IUser` from Task 2
- Produces: updated REST API for user CRUD — used by Task 7 (frontend)

- [ ] **Step 1: Replace the admin guard in `backend/src/routes/users.ts` (lines 13–18)**

```typescript
router.use(authMiddleware);
router.use((req: AuthRequest, res: Response, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  next();
});
```

- [ ] **Step 2: Add import for `isValidOrg` at the top of `users.ts`**

After the existing imports, add:
```typescript
import { isValidOrg } from '../config/org-structure';
```

- [ ] **Step 3: Replace POST `/api/users` handler body (lines 43–90)**

```typescript
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { phone, password, name, isAdmin, division, group, position } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Введіть номер телефону та пароль' });
    }
    if (!division || !group || !position) {
      return res.status(400).json({ message: 'Вкажіть підрозділ, групу та посаду' });
    }
    if (!isValidOrg(String(division), String(group), String(position))) {
      return res.status(400).json({ message: 'Невалідна організаційна структура' });
    }

    const normalizedPhone = normalizePhone(String(phone));
    if (await User.findOne({ phone: { $in: [normalizedPhone, '38' + normalizedPhone] } })) {
      return res.status(409).json({ message: 'Користувач з таким номером вже існує' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 12);
    const user = await User.create({
      phone:    normalizedPhone,
      password: hashedPassword,
      name:     name || '',
      isAdmin:  Boolean(isAdmin),
      division: String(division),
      group:    String(group),
      position: String(position),
    });

    try {
      await sendSms(
        '38' + normalizedPhone,
        `Вітаємо в Камея Таємний.\nВаш доступ до платформи:\nНомер: ${normalizedPhone}\nПароль: ${password}\nАдреса: mysteryshopper.kameya.if.ua`
      );
    } catch (smsError) {
      console.error('[SMS] Не вдалось надіслати:', smsError);
    }

    return res.status(201).json({
      _id:      user._id,
      phone:    user.phone,
      name:     user.name,
      isAdmin:  user.isAdmin,
      division: user.division,
      group:    user.group,
      position: user.position,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});
```

- [ ] **Step 4: Replace PATCH `/api/users/:id` handler body (lines 93–122)**

```typescript
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, division, group, position, password, isAdmin, phone } = req.body;
    const update: Record<string, unknown> = {};

    if (name     !== undefined) update.name     = name;
    if (isAdmin  !== undefined) update.isAdmin  = Boolean(isAdmin);
    if (division !== undefined) update.division = division;
    if (group    !== undefined) update.group    = group;
    if (position !== undefined) update.position = position;
    if (password) update.password = await bcrypt.hash(String(password), 12);

    if (division !== undefined || group !== undefined || position !== undefined) {
      const user = await User.findById(req.params.id);
      const checkDivision = String(division ?? user?.division ?? '');
      const checkGroup    = String(group    ?? user?.group    ?? '');
      const checkPosition = String(position ?? user?.position ?? '');
      if (!isValidOrg(checkDivision, checkGroup, checkPosition)) {
        return res.status(400).json({ message: 'Невалідна організаційна структура' });
      }
    }

    if (phone !== undefined) {
      const normalized = normalizePhone(String(phone));
      const existing = await User.findOne({ phone: { $in: [normalized, '38' + normalized] }, _id: { $ne: req.params.id } });
      if (existing) return res.status(409).json({ message: 'Користувач з таким номером вже існує' });
      update.phone = normalized;
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});
```

- [ ] **Step 5: Fix `evaluate-student-of-year` endpoint — filter by `isAdmin: false` instead of `role: 'EMPLOYEE'`**

Find `const employees = await User.find({ role: 'EMPLOYEE' }` and replace:
```typescript
const employees = await User.find({ isAdmin: false }, '_id').lean();
```

- [ ] **Step 6: Update seed.ts**

Find the existing admin user seed and update it:
```typescript
// Replace the existing user object in seed.ts
{
  phone:    '0508098182',
  password: await bcrypt.hash('27071996uA', 12),
  name:     'Адміністратор',
  isAdmin:  true,
  division: 'office',
  group:    'management',
  position: 'Керівник',
}
```

- [ ] **Step 7: Verify TypeScript compiles with no errors**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/users.ts backend/src/seed.ts
git commit -m "feat: update user routes and seed to use isAdmin + org structure"
```

---

### Task 5: Migration script for existing users

**Files:**
- Create: `backend/src/migrate-org.ts`

**Interfaces:**
- Consumes: `IUser` from Task 2; `ORG_STRUCTURE` from Task 1
- Produces: migrated MongoDB documents — no code consumers, run once

- [ ] **Step 1: Create migration script**

```typescript
// backend/src/migrate-org.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Direct schema without importing User model to avoid validation issues with old data
const RawUser = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

const STORE_MAP: Record<string, string> = {
  'Арсен':           'store_1',
  'Бельведерська':   'store_2',
  'Галицька':        'store_3',
  'Галич':           'store_4',
  'Коломия':         'store_5',
  'Надвірна золото': 'store_6',
  'Надвірна срібло': 'store_7',
  'Цум':             'store_8',
  'Шашкевича':       'store_9',
  'Шпитальна':       'store_10',
};

async function migrate() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kameya';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const users = await RawUser.find({}).lean() as Array<Record<string, unknown>>;
  console.log(`Found ${users.length} users`);

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const id = user._id;
    const role = user.role as string | undefined;
    const store = user.store as string | undefined;

    // Skip users already migrated
    if (user.division !== undefined) {
      skipped++;
      continue;
    }

    const isAdmin = role === 'ADMIN';
    let division = 'stores';
    let group = '';
    let position = (user.position as string) || '';

    if (isAdmin) {
      division = 'office';
      group = 'management';
      position = position || 'Керівник';
    } else if (store) {
      const mapped = STORE_MAP[store];
      if (mapped) {
        group = mapped;
        division = 'stores';
        if (!['Керівник', 'Консультант', 'Початківець консультант'].includes(position)) {
          position = 'Консультант';
        }
      } else {
        console.warn(`  [WARN] Could not map store "${store}" for user ${id} — setting group to empty`);
        group = '';
      }
    }

    await RawUser.updateOne(
      { _id: id },
      {
        $set: { isAdmin, division, group, position },
        $unset: { role: '', store: '' },
      }
    );

    console.log(`  Updated ${user.name || id}: isAdmin=${isAdmin} division=${division} group=${group} position=${position}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already migrated): ${skipped}`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add migration script to package.json scripts**

In `backend/package.json`, add to `"scripts"`:
```json
"migrate:org": "ts-node src/migrate-org.ts"
```

- [ ] **Step 3: Run the migration**

```bash
cd backend && npm run migrate:org
```

Expected output: list of updated users with their new org fields, no errors.

- [ ] **Step 4: Verify in MongoDB (or via API)**

```bash
# Start the backend and check a user via curl or the admin panel after frontend is updated
cd backend && npm run dev
```

Check that `/api/users` returns users with `division`, `group`, `position`, `isAdmin` fields and no `role` or `store`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/migrate-org.ts backend/package.json
git commit -m "feat: add org structure migration script"
```

---

### Task 6: Update frontend types and services

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/usersService.ts`

**Interfaces:**
- Produces: updated `AuthUser`, `UserListItem`, `CreateUserPayload`, `UpdateUserPayload` — used by Tasks 7, 8

- [ ] **Step 1: Update `AuthUser` interface in `frontend/src/types.ts` (lines 77–85)**

```typescript
export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  isAdmin: boolean;
  division: string;
  group: string;
  position: string;
  points: number;
}
```

- [ ] **Step 2: Update `UserListItem` interface in `frontend/src/types.ts` (lines 87–96)**

```typescript
export interface UserListItem {
  _id: string;
  phone: string;
  name: string;
  isAdmin: boolean;
  division: string;
  group: string;
  position: string;
  points?: number;
  createdAt: string;
}
```

- [ ] **Step 3: Remove `STORES` and `EMPLOYEE_POSITIONS` constants from `frontend/src/types.ts` (lines 161–177)**

Delete these lines entirely — they are replaced by `ORG_STRUCTURE` from Task 1.

- [ ] **Step 4: Update `CreateUserPayload` in `frontend/src/services/usersService.ts` (lines 10–17)**

```typescript
export interface CreateUserPayload {
  phone: string;
  password: string;
  name: string;
  isAdmin: boolean;
  division: string;
  group: string;
  position: string;
}
```

- [ ] **Step 5: Update `UpdateUserPayload` in `frontend/src/services/usersService.ts` (lines 32–39)**

```typescript
export interface UpdateUserPayload {
  name?: string;
  phone?: string;
  isAdmin?: boolean;
  division?: string;
  group?: string;
  position?: string;
  password?: string;
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: errors in components that still use `user.role` or `user.store` — fixed in Tasks 7 and 8.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/usersService.ts
git commit -m "feat: update frontend types and service payloads for org structure"
```

---

### Task 7: Update frontend auth checks (App.tsx and Layout.tsx)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `AuthUser.isAdmin` from Task 6; `getDivisionLabel`, `getGroupLabel` from Task 1

- [ ] **Step 1: Fix `App.tsx` — replace role check (line 25)**

Find:
```typescript
const isAdmin = user?.role === 'ADMIN';
```
Replace with:
```typescript
const isAdmin = user?.isAdmin ?? false;
```

- [ ] **Step 2: Fix `Layout.tsx` — replace role checks**

Find (line 51):
```typescript
const isAdmin = user.role === 'ADMIN';
```
Replace with:
```typescript
const isAdmin = user.isAdmin;
```

Find the two display lines that show `'Адміністратор'` vs `user.position` (lines 117 and 189):
```typescript
{user.role === 'ADMIN' ? 'Адміністратор' : (user.position ?? user.phone)}
```
Replace both with:
```typescript
{user.position || user.phone}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: errors only in `UsersView.tsx` and `ReportsUploadView.tsx` — fixed in Task 8.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: replace role === ADMIN checks with isAdmin flag in App and Layout"
```

---

### Task 8: Update UsersView and ReportsUploadView

**Files:**
- Modify: `frontend/src/components/admin/UsersView.tsx`
- Modify: `frontend/src/components/admin/ReportsUploadView.tsx`

**Interfaces:**
- Consumes: `UserListItem` with `isAdmin`, `division`, `group`, `position` from Task 6; `ORG_STRUCTURE`, `getDivisionLabel`, `getGroupLabel` from Task 1; `CreateUserPayload`, `UpdateUserPayload` from Task 6

- [ ] **Step 1: Add org-structure import to `UsersView.tsx`**

Add at the top of the file, after existing imports:
```typescript
import { ORG_STRUCTURE, getDivisionLabel, getGroupLabel } from '../../config/org-structure';
```

Also remove `STORES, EMPLOYEE_POSITIONS` from the `../../types` import line.

- [ ] **Step 2: Replace `EMPTY_CREATE` constant in `UsersView.tsx` (line 19–21)**

```typescript
const EMPTY_CREATE: CreateUserPayload = {
  phone: '', password: '', name: '', isAdmin: false, division: 'stores', group: '', position: '',
};
```

- [ ] **Step 3: Replace the create form state type in `UsersView.tsx` (line 51)**

```typescript
const [editForm, setEditForm] = useState<UpdateUserPayload & { division: string; group: string; position: string }>({
  name: '', phone: '', isAdmin: false, division: '', group: '', position: '', password: '',
});
```

- [ ] **Step 4: Replace the sort keys type in `UsersView.tsx` (line 68)**

```typescript
type SortKey = 'name' | 'isAdmin' | 'position' | 'division' | 'points';
```

- [ ] **Step 5: Update filter logic in `UsersView.tsx` (line 78–82)**

Find the `filteredUsers` block that references `u.store`. Replace `u.store` with `getGroupLabel(u.division, u.group)`:
```typescript
const q = search.toLowerCase().trim();
const filteredUsers = q
  ? users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      (u.position ?? '').toLowerCase().includes(q) ||
      getGroupLabel(u.division, u.group).toLowerCase().includes(q) ||
      getDivisionLabel(u.division).toLowerCase().includes(q)
    )
  : users;
```

- [ ] **Step 6: Replace the create form JSX with cascading dropdowns**

In the create modal form, replace the `role`, `position`, and `store` inputs with:

```tsx
{/* Division */}
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">Підрозділ</label>
  <select
    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
    value={createForm.division}
    onChange={e => setCreateForm(f => ({ ...f, division: e.target.value, group: '', position: '' }))}
  >
    <option value="">— Оберіть підрозділ —</option>
    {(Object.entries(ORG_STRUCTURE) as [string, { label: string }][]).map(([key, val]) => (
      <option key={key} value={key}>{val.label}</option>
    ))}
  </select>
</div>

{/* Group */}
{createForm.division && (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Група</label>
    <select
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      value={createForm.group}
      onChange={e => setCreateForm(f => ({ ...f, group: e.target.value, position: '' }))}
    >
      <option value="">— Оберіть групу —</option>
      {(Object.entries(ORG_STRUCTURE[createForm.division as keyof typeof ORG_STRUCTURE].groups) as [string, string][]).map(([key, label]) => (
        <option key={key} value={key}>{label}</option>
      ))}
    </select>
  </div>
)}

{/* Position */}
{createForm.division && createForm.group && (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Посада</label>
    <select
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      value={createForm.position}
      onChange={e => setCreateForm(f => ({ ...f, position: e.target.value }))}
    >
      <option value="">— Оберіть посаду —</option>
      {[...ORG_STRUCTURE[createForm.division as keyof typeof ORG_STRUCTURE].positions].map((pos) => (
        <option key={pos} value={pos}>{pos}</option>
      ))}
    </select>
  </div>
)}

{/* Admin flag */}
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="create-isAdmin"
    checked={createForm.isAdmin}
    onChange={e => setCreateForm(f => ({ ...f, isAdmin: e.target.checked }))}
    className="rounded"
  />
  <label htmlFor="create-isAdmin" className="text-sm font-medium text-slate-700">
    Адміністратор
  </label>
</div>
```

- [ ] **Step 7: Apply same cascading dropdowns to the edit form**

In the edit modal, replace `role`, `position`, `store` inputs with the same pattern as above but reading from `editForm` and calling `setEditForm`.

When opening the edit modal (in the `setEditUser` / open handler), populate:
```typescript
setEditForm({
  name:     user.name,
  phone:    user.phone,
  isAdmin:  user.isAdmin,
  division: user.division,
  group:    user.group,
  position: user.position,
  password: '',
});
```

- [ ] **Step 8: Update the users table columns**

Replace `role` and `store` column headers and cells with `division`/`group` equivalents. For example, the table row cell that showed `u.store` should now show `getGroupLabel(u.division, u.group)`, and the `role` badge should show `u.isAdmin ? 'Адмін' : getDivisionLabel(u.division)`.

- [ ] **Step 9: Fix `ReportsUploadView.tsx`**

Find line 68:
```typescript
.then((all) => setEmployees(all.filter((u) => u.role === 'EMPLOYEE')))
```
Replace with:
```typescript
.then((all) => setEmployees(all.filter((u) => !u.isAdmin)))
```

Find all references to `u.store` or `selectedEmployee?.store` in this file and replace with `getGroupLabel(u.division, u.group)` or `getGroupLabel(selectedEmployee.division, selectedEmployee.group)`.

Add this import at the top of `ReportsUploadView.tsx`:
```typescript
import { getGroupLabel } from '../../config/org-structure';
```

- [ ] **Step 10: Verify TypeScript compiles with zero errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 11: Start both servers and test**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Test checklist:
- [ ] Login as admin — redirects to admin panel
- [ ] Login as employee — sees their own dashboard
- [ ] Admin panel: create a new user — cascading dropdowns work (division → group → position)
- [ ] Admin panel: edit a user — dropdowns pre-filled with current values
- [ ] Reports upload: employee dropdown only shows non-admin users

- [ ] **Step 12: Commit**

```bash
git add frontend/src/components/admin/UsersView.tsx frontend/src/components/admin/ReportsUploadView.tsx
git commit -m "feat: update UsersView and ReportsUploadView for org structure"
```
