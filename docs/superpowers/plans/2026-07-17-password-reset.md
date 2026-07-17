# Password Reset via SMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users (ADMIN and EMPLOYEE) change their own password via a 3-step SMS OTP modal accessible from the profile area in the navigation.

**Architecture:** Two new public backend endpoints handle OTP generation and verification, storing codes in a module-level in-memory Map. The frontend shows a portal modal with 3 steps (request code → enter code → set new password); on success, `logout()` is called which automatically renders LoginPage.

**Tech Stack:** Express + Mongoose + bcryptjs + SMSClub (backend); React + TypeScript + Tailwind CSS (frontend). Backend runs on port 3001; Vite dev server on 5173 with `/api` proxy.

## Global Constraints

- Minimum new password length: 8 characters — enforced on both frontend and backend
- OTP: exactly 6 numeric digits, valid for 10 minutes
- OTP storage: in-memory `Map` on the backend — no DB schema changes
- SMS text format: `"Камея: Ваш код для зміни пароля — XXXXXX. Дійсний 10 хвилин."`
- Phone normalization: same logic as existing `normalizePhone()` in `backend/src/routes/auth.ts`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/src/routes/auth.ts` | Add in-memory OTP Map + 2 new public endpoints |
| Create | `frontend/src/services/passwordResetService.ts` | API helpers: `requestResetCode`, `confirmReset` |
| Create | `frontend/src/components/ChangePasswordModal.tsx` | 3-step modal with OTP + new password flow |
| Modify | `frontend/src/components/Layout.tsx` | Add optional `onChangePassword` prop + buttons in sidebar and mobile dropdown |
| Modify | `frontend/src/App.tsx` | Add `changePasswordOpen` state, render modal, pass prop to Layout |

---

### Task 1: Backend — OTP endpoints

**Files:**
- Modify: `backend/src/routes/auth.ts`

**Interfaces:**
- Produces:
  - `POST /api/auth/request-reset-code` body `{ phone: string }` → 200 `{ message: string }` | 400 | 404 | 500
  - `POST /api/auth/confirm-reset` body `{ phone: string, code: string, newPassword: string }` → 200 `{ message: string }` | 400 | 404 | 500

- [ ] **Step 1: Add `sendSms` import and the OTP Map at the top of `backend/src/routes/auth.ts`**

The file currently imports `Router, Request, Response`, `bcrypt`, `jwt`, `User`, `SystemLog`. Add the `sendSms` import and declare the Map right after the existing imports and before `const router = Router();`:

```typescript
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { SystemLog } from '../models/SystemLog';
import { sendSms } from '../services/sms';

const router = Router();

const resetCodes = new Map<string, { code: string; expiry: number }>();
```

- [ ] **Step 2: Append `POST /api/auth/request-reset-code` before `export default router`**

```typescript
router.post('/request-reset-code', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Вкажіть номер телефону' });

    const normalizedPhone = normalizePhone(String(phone));
    const user = await User.findOne({
      phone: { $in: [normalizedPhone, '38' + normalizedPhone] },
    });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(normalizedPhone, { code, expiry: Date.now() + 10 * 60 * 1000 });

    await sendSms(
      '38' + normalizedPhone,
      `Камея: Ваш код для зміни пароля — ${code}. Дійсний 10 хвилин.`,
    );

    return res.json({ message: 'Код надіслано' });
  } catch (error) {
    console.error('request-reset-code error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});
```

- [ ] **Step 3: Append `POST /api/auth/confirm-reset` before `export default router`**

```typescript
router.post('/confirm-reset', async (req: Request, res: Response) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) {
      return res.status(400).json({ message: 'Заповніть всі поля' });
    }

    const normalizedPhone = normalizePhone(String(phone));
    const entry = resetCodes.get(normalizedPhone);

    if (!entry) {
      return res.status(400).json({ message: 'Код не знайдено або вже використано' });
    }
    if (Date.now() > entry.expiry) {
      resetCodes.delete(normalizedPhone);
      return res.status(400).json({ message: 'Код застарів. Запросіть новий.' });
    }
    if (entry.code !== String(code)) {
      return res.status(400).json({ message: 'Невірний код' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Пароль має містити мінімум 8 символів' });
    }

    const user = await User.findOne({
      phone: { $in: [normalizedPhone, '38' + normalizedPhone] },
    });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    user.password = await bcrypt.hash(String(newPassword), 12);
    await user.save();
    resetCodes.delete(normalizedPhone);

    return res.json({ message: 'Пароль змінено' });
  } catch (error) {
    console.error('confirm-reset error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});
```

- [ ] **Step 4: Restart the backend and manually verify endpoints**

```bash
# Start backend (from repo root)
cd backend && npx ts-node-dev --respawn --transpile-only src/index.ts
```

In a second terminal (replace `0XXXXXXXXX` with a real phone stored in the DB):

```bash
# Expect: { "message": "Код надіслано" } and SMS arrives
curl -s -X POST http://localhost:3001/api/auth/request-reset-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"0XXXXXXXXX"}' | jq

# Expect: { "message": "Невірний код" }
curl -s -X POST http://localhost:3001/api/auth/confirm-reset \
  -H "Content-Type: application/json" \
  -d '{"phone":"0XXXXXXXXX","code":"000000","newPassword":"newpass123"}' | jq

# With the real code from SMS — expect: { "message": "Пароль змінено" }
curl -s -X POST http://localhost:3001/api/auth/confirm-reset \
  -H "Content-Type: application/json" \
  -d '{"phone":"0XXXXXXXXX","code":"XXXXXX","newPassword":"newpass123"}' | jq
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.ts
git commit -m "feat: add SMS OTP endpoints for password reset"
```

---

### Task 2: Frontend service

**Files:**
- Create: `frontend/src/services/passwordResetService.ts`

**Interfaces:**
- Produces:
  - `requestResetCode(phone: string): Promise<void>` — throws `Error` with server message on non-2xx response
  - `confirmReset(phone: string, code: string, newPassword: string): Promise<void>` — throws `Error` with server message on non-2xx response

Note: these endpoints are public (no auth token needed), so raw `fetch` is used — same pattern as `authService.ts`.

- [ ] **Step 1: Create `frontend/src/services/passwordResetService.ts`**

```typescript
const apiPost = async (path: string, body: object): Promise<void> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || 'Помилка сервера');
  }
};

export const requestResetCode = (phone: string): Promise<void> =>
  apiPost('/api/auth/request-reset-code', { phone });

export const confirmReset = (
  phone: string,
  code: string,
  newPassword: string,
): Promise<void> => apiPost('/api/auth/confirm-reset', { phone, code, newPassword });
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/passwordResetService.ts
git commit -m "feat: add passwordResetService API helpers"
```

---

### Task 3: ChangePasswordModal component

**Files:**
- Create: `frontend/src/components/ChangePasswordModal.tsx`

**Interfaces:**
- Consumes:
  - `requestResetCode(phone: string): Promise<void>` from `../services/passwordResetService`
  - `confirmReset(phone: string, code: string, newPassword: string): Promise<void>` from `../services/passwordResetService`
  - `useAuth()` → `{ user: AuthUser | null; logout: () => void }` from `../context/AuthContext`
- Props: `{ open: boolean; onClose: () => void }`

- [ ] **Step 1: Create `frontend/src/components/ChangePasswordModal.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { requestResetCode, confirmReset } from '../services/passwordResetService';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 font-medium flex items-center gap-2">
    <i className="fas fa-triangle-exclamation flex-shrink-0" />
    <span>{message}</span>
  </div>
);

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setIsLoading(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [open]);

  if (!open || !user) return null;

  const displayPhone = user.phone.startsWith('38') ? user.phone.slice(2) : user.phone;

  const handleSendCode = async () => {
    setError('');
    setIsLoading(true);
    try {
      await requestResetCode(user.phone);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка надсилання коду');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (code.length !== 6) {
      setError('Введіть 6-значний код');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 8) {
      setError('Пароль має містити мінімум 8 символів');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Паролі не збігаються');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await confirmReset(user.phone, code, newPassword);
      logout();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка зміни пароля');
      setIsLoading(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <i className="fas fa-xmark" />
        </button>

        <h2 className="text-xl font-bold text-slate-800 mb-1">Зміна пароля</h2>

        {step === 1 && (
          <div className="space-y-5 mt-4">
            <p className="text-sm text-slate-500">
              Щоб змінити пароль, ми надішлемо 6-значний код підтвердження на ваш номер.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-medium flex items-center gap-2">
              <i className="fas fa-mobile-screen-button text-kameya-burgundy" />
              {displayPhone}
            </div>
            {error && <ErrorBanner message={error} />}
            <button
              onClick={handleSendCode}
              disabled={isLoading}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading
                ? <i className="fas fa-spinner fa-spin" />
                : <i className="fas fa-paper-plane" />}
              Надіслати код
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 mt-4">
            <p className="text-sm text-slate-500">
              Введіть 6-значний код із SMS від Камея.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="• • • • • •"
              autoFocus
              className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-center text-3xl tracking-[0.6em] placeholder:text-slate-300 placeholder:text-lg focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all"
            />
            {error && <ErrorBanner message={error} />}
            <button
              onClick={handleVerifyCode}
              disabled={code.length !== 6}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60"
            >
              Далі
            </button>
            <button
              onClick={() => { setStep(1); setCode(''); setError(''); }}
              className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
            >
              Надіслати код повторно
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-slate-500">
              Придумайте новий пароль (мінімум 8 символів).
            </p>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Новий пароль"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className={`fas ${showNew ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Підтвердження пароля"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
            {error && <ErrorBanner message={error} />}
            <button
              onClick={handleSavePassword}
              disabled={isLoading || !newPassword || !confirmPassword}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && <i className="fas fa-spinner fa-spin" />}
              Зберегти
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ChangePasswordModal.tsx
git commit -m "feat: add ChangePasswordModal with 3-step SMS OTP flow"
```

---

### Task 4: Layout integration

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: new optional prop `onChangePassword?: () => void` added to `LayoutProps`

- [ ] **Step 1: Add `onChangePassword` to `LayoutProps` interface and destructuring**

Find `interface LayoutProps` and add the new optional prop:

```tsx
interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  user: AuthUser;
  onLogout: () => void;
  notificationsUnread?: number;
  systemUnread?: number;
  onOpenSystemPanel?: () => void;
  onChangePassword?: () => void;
}
```

In the component signature, add `onChangePassword` to the destructured props:

```tsx
export const Layout: React.FC<LayoutProps> = ({
  children,
  activeScreen,
  onNavigate,
  user,
  onLogout,
  notificationsUnread = 0,
  systemUnread = 0,
  onOpenSystemPanel,
  onChangePassword,
}) => {
```

- [ ] **Step 2: Add "Змінити пароль" button in the desktop sidebar**

Inside the desktop sidebar footer `<div className="p-4 border-t border-white/20 bg-black/10">`, add this button immediately before the existing logout `<button onClick={onLogout} ...>`:

```tsx
{onChangePassword && (
  <button
    onClick={onChangePassword}
    className="w-full text-xs text-white/60 hover:text-white/90 py-2 rounded-lg hover:bg-white/10 transition-colors text-left px-2 flex items-center space-x-2 mb-1"
  >
    <i className="fas fa-lock"></i>
    <span>Змінити пароль</span>
  </button>
)}
```

- [ ] **Step 3: Add "Змінити пароль" item in the mobile dropdown**

Inside the mobile dropdown `<div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[140px] py-1 z-50">`, add this item immediately before the existing logout `<button onClick={() => { setUserMenuOpen(false); onLogout(); }} ...>`:

```tsx
{onChangePassword && (
  <button
    onClick={() => { setUserMenuOpen(false); onChangePassword(); }}
    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
  >
    <i className="fas fa-lock text-xs"></i>
    <span>Змінити пароль</span>
  </button>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: add Change Password button to sidebar and mobile dropdown"
```

---

### Task 5: App.tsx wiring

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes:
  - `ChangePasswordModal` from `./components/ChangePasswordModal`
  - `onChangePassword` prop on `<Layout>`

- [ ] **Step 1: Add import for `ChangePasswordModal`**

At the top of `frontend/src/App.tsx`, add after the last existing component import:

```tsx
import { ChangePasswordModal } from './components/ChangePasswordModal';
```

- [ ] **Step 2: Add `changePasswordOpen` state inside `AppContent`**

Inside `AppContent`, after the existing `useState` declarations:

```tsx
const [changePasswordOpen, setChangePasswordOpen] = useState(false);
```

- [ ] **Step 3: Add `onChangePassword` prop to `<Layout>` and render `<ChangePasswordModal>`**

In the `return` block, update `<Layout>` to pass the new prop:

```tsx
<Layout
  activeScreen={currentScreen}
  onNavigate={handleNavigate}
  user={user}
  onLogout={logout}
  notificationsUnread={notificationsUnread}
  systemUnread={systemUnread}
  onOpenSystemPanel={() => setSystemPanelOpen(true)}
  onChangePassword={() => setChangePasswordOpen(true)}
>
```

Immediately after the opening `<Layout>` tag (before the `{toast && ...}` block), add the modal:

```tsx
<ChangePasswordModal
  open={changePasswordOpen}
  onClose={() => setChangePasswordOpen(false)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire ChangePasswordModal into App"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1 — backend
cd backend && npx ts-node-dev --respawn --transpile-only src/index.ts

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open `http://localhost:5173` and log in.

- [ ] **Step 2: Desktop flow — happy path**

1. In the left sidebar, find "Змінити пароль" button below "Системні сповіщення" (admin) / user info (employee) and above "Вийти"
2. Click it → modal opens showing Step 1 with the user's phone number
3. Click "Надіслати код" → spinner appears momentarily, then Step 2 appears; SMS arrives on the phone with 6-digit code
4. Enter the code → "Далі" button becomes enabled → click it → Step 3 appears
5. Enter a new password of 7 characters → click "Зберегти" → error: "Пароль має містити мінімум 8 символів"
6. Enter valid password (≥ 8 chars) in first field, a different string in second → error: "Паролі не збігаються"
7. Enter valid matching passwords (≥ 8 chars) → click "Зберегти" → spinner → modal closes → LoginPage appears
8. Log in with the new password → success

- [ ] **Step 3: Mobile flow**

1. Resize browser to < 768px (or open DevTools mobile emulation)
2. Tap the avatar circle in the top-right header → dropdown opens with "Змінити пароль" above "Вийти"
3. Tap "Змінити пароль" → modal opens; same 3-step flow works correctly

- [ ] **Step 4: Error / edge-case checks**

- Wrong 6-digit code (entered as Step 3): backend returns "Невірний код" → shown as inline red banner; user stays on Step 3
- Close modal with ✕ at any step → reopening resets to Step 1
- "Надіслати код повторно" on Step 2 → returns to Step 1 with code cleared
- Non-existent phone (server returns 404 on request-reset-code): inline error shown on Step 1 ✓
