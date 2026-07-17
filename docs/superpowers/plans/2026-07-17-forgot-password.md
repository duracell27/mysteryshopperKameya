# Forgot Password Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Забули пароль?" link on the login page that lets an unauthenticated user reset their password via SMS OTP in a 3-step modal.

**Architecture:** Three new unauthenticated Express endpoints accept phone + code in the request body (instead of reading phone from a JWT). A new `ForgotPasswordModal` component mirrors the existing `ChangePasswordModal` 3-step flow, rendered from `LoginPage`. After a successful reset the modal closes and the user logs in manually.

**Tech Stack:** Express + TypeScript (backend), React 18 + TypeScript + Tailwind CSS (frontend), existing `sendSms` service, `bcryptjs`, shared in-memory `resetCodes` Map.

## Global Constraints

- Phone normalization: always call `normalizePhone()` — strips non-digits, converts `380…` → `0…`
- SMS body prefix: `Камея:` (matches existing SMS messages)
- Minimum password length: 8 characters
- OTP expiry: 10 minutes (600 000 ms)
- Code stored in the shared `resetCodes` Map in `auth.ts`, key = normalized phone
- Return generic error messages that don't reveal whether a phone number exists
- Delete code from Map on any wrong-code attempt
- Log `password_changed` event to `SystemLog` after successful reset
- All Ukrainian UI copy, matching existing patterns

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/src/routes/auth.ts` | Modify | Add 3 new unauthenticated routes |
| `frontend/src/services/forgotPasswordService.ts` | Create | API calls for unauthenticated forgot-password flow |
| `frontend/src/components/ForgotPasswordModal.tsx` | Create | 3-step modal (phone → OTP → new password) |
| `frontend/src/pages/LoginPage.tsx` | Modify | Add "Забули пароль?" link + mount modal |

---

### Task 1: Backend — three unauthenticated forgot-password endpoints

**Files:**
- Modify: `backend/src/routes/auth.ts`

**Interfaces:**
- Produces:
  - `POST /api/auth/forgot/request` — body `{ phone: string }` → `200 { message: string }` or `404/400/500`
  - `POST /api/auth/forgot/verify` — body `{ phone: string, code: string }` → `200 { message: string }` or `400/500`
  - `POST /api/auth/forgot/confirm` — body `{ phone: string, code: string, newPassword: string }` → `200 { message: string }` or `400/404/500`

- [ ] **Step 1: Add the three routes to `backend/src/routes/auth.ts`**

Open `backend/src/routes/auth.ts`. After the last existing route (the `confirm-reset` route ending around line 174) and before `export default router;`, add:

```typescript
router.post('/forgot/request', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Введіть номер телефону' });

    const normalizedPhone = normalizePhone(String(phone));
    const user = await User.findOne({
      phone: { $in: [normalizedPhone, '38' + normalizedPhone] },
    });
    if (!user) {
      // Generic message — don't reveal whether number exists
      return res.json({ message: 'Код надіслано' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(normalizedPhone, { code, expiry: Date.now() + 10 * 60 * 1000 });

    await sendSms(
      '38' + normalizedPhone,
      `Камея: Ваш код для відновлення пароля — ${code}. Дійсний 10 хвилин.`,
    );

    return res.json({ message: 'Код надіслано' });
  } catch (error) {
    console.error('forgot/request error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});

router.post('/forgot/verify', async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: 'Заповніть всі поля' });

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
      resetCodes.delete(normalizedPhone);
      return res.status(400).json({ message: 'Невірний код' });
    }

    return res.json({ message: 'Код підтверджено' });
  } catch (error) {
    console.error('forgot/verify error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});

router.post('/forgot/confirm', async (req: Request, res: Response) => {
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
      resetCodes.delete(normalizedPhone);
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

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      null;
    SystemLog.create({ type: 'password_changed', phone: normalizedPhone, userName: user.name || null, ip })
      .catch(() => {});

    return res.json({ message: 'Пароль змінено' });
  } catch (error) {
    console.error('forgot/confirm error:', error);
    return res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke-test the endpoints with curl**

Start the backend dev server in one terminal: `cd backend && npm run dev`

Then in another terminal:

```bash
# Should return { message: 'Код надіслано' } (even for non-existent number)
curl -s -X POST http://localhost:3000/api/auth/forgot/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"0000000000"}' | cat

# Should return 400 — code not found
curl -s -X POST http://localhost:3000/api/auth/forgot/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"0000000000","code":"123456"}' | cat
```

Expected first response: `{"message":"Код надіслано"}`
Expected second response: `{"message":"Код не знайдено або вже використано"}`

- [ ] **Step 4: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add backend/src/routes/auth.ts
git commit -m "feat: add unauthenticated forgot-password endpoints"
```

---

### Task 2: Frontend service — `forgotPasswordService.ts`

**Files:**
- Create: `frontend/src/services/forgotPasswordService.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./apiFetch` (same pattern as `passwordResetService.ts`)
- Produces:
  - `requestForgotCode(phone: string): Promise<void>`
  - `verifyForgotCode(phone: string, code: string): Promise<void>`
  - `confirmForgotPassword(phone: string, code: string, newPassword: string): Promise<void>`

- [ ] **Step 1: Create `frontend/src/services/forgotPasswordService.ts`**

```typescript
import { apiFetch } from './apiFetch';

const apiPost = async (path: string, body: object): Promise<void> => {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || 'Помилка сервера');
  }
};

export const requestForgotCode = (phone: string): Promise<void> =>
  apiPost('/api/auth/forgot/request', { phone });

export const verifyForgotCode = (phone: string, code: string): Promise<void> =>
  apiPost('/api/auth/forgot/verify', { phone, code });

export const confirmForgotPassword = (phone: string, code: string, newPassword: string): Promise<void> =>
  apiPost('/api/auth/forgot/confirm', { phone, code, newPassword });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add frontend/src/services/forgotPasswordService.ts
git commit -m "feat: add forgotPasswordService"
```

---

### Task 3: Frontend component — `ForgotPasswordModal.tsx`

**Files:**
- Create: `frontend/src/components/ForgotPasswordModal.tsx`

**Interfaces:**
- Consumes:
  - `requestForgotCode(phone: string): Promise<void>` from `../services/forgotPasswordService`
  - `verifyForgotCode(phone: string, code: string): Promise<void>` from `../services/forgotPasswordService`
  - `confirmForgotPassword(phone: string, code: string, newPassword: string): Promise<void>` from `../services/forgotPasswordService`
- Produces: `<ForgotPasswordModal open={boolean} onClose={() => void} />` — React component

- [ ] **Step 1: Create `frontend/src/components/ForgotPasswordModal.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { requestForgotCode, verifyForgotCode, confirmForgotPassword } from '../services/forgotPasswordService';

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 'success';

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 font-medium flex items-center gap-2">
    <i className="fas fa-triangle-exclamation flex-shrink-0" />
    <span>{message}</span>
  </div>
);

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ open, onClose }) => {
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState('');
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
      setPhone('');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setIsLoading(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSendCode = async () => {
    if (!phone.trim()) {
      setError('Введіть номер телефону');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await requestForgotCode(phone.trim());
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка надсилання коду');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError('Введіть 6-значний код');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await verifyForgotCode(phone.trim(), code);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Невірний або застарілий код');
    } finally {
      setIsLoading(false);
    }
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
      await confirmForgotPassword(phone.trim(), code, newPassword);
      setStep('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка зміни пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step !== 'success' ? onClose : undefined} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 z-10">
        {step !== 'success' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <i className="fas fa-xmark" />
          </button>
        )}

        <h2 className="text-xl font-bold text-slate-800 mb-1">Відновлення пароля</h2>

        {step === 1 && (
          <div className="space-y-5 mt-4">
            <p className="text-sm text-slate-500">
              Введіть ваш номер телефону. Ми надішлемо 6-значний код підтвердження.
            </p>
            <div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0508098182"
                autoFocus
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 pl-1">
                Формат: 0508098182, +380508098182
              </p>
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
              disabled={code.length !== 6 || isLoading}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && <i className="fas fa-spinner fa-spin" />}
              Далі
            </button>
            <button
              onClick={() => { setCode(''); setError(''); handleSendCode(); }}
              disabled={isLoading}
              className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors py-1 disabled:opacity-40"
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

        {step === 'success' && (
          <div className="space-y-5 mt-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <i className="fas fa-check text-2xl text-green-500" />
            </div>
            <p className="text-sm text-slate-600 font-medium">
              Пароль успішно змінено.<br />Увійдіть з новим паролем.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-kameya-burgundy text-white py-3.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20"
            >
              До входу
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add frontend/src/components/ForgotPasswordModal.tsx
git commit -m "feat: add ForgotPasswordModal component"
```

---

### Task 4: Wire modal into LoginPage

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `<ForgotPasswordModal open={boolean} onClose={() => void} />` from `../components/ForgotPasswordModal`

- [ ] **Step 1: Update `frontend/src/pages/LoginPage.tsx`**

Replace the entire file content with:

```typescript
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';

export const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(phone, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Невірний номер телефону або пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <img src="/LogoBordo.png" alt="Kameya Academy" className="h-16 w-auto" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Вхід до кабінету</h2>
          <p className="text-sm text-slate-500 mb-8">
            Введіть ваші дані для доступу до особистого кабінету
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Номер телефону
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0508098182"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all"
                required
                autoComplete="tel"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 pl-1">
                Формат: 0508098182, +380508098182, 050 809 81 82
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Пароль
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs text-kameya-burgundy hover:opacity-70 transition-opacity font-medium"
                >
                  Забули пароль?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy transition-all pr-12"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-600 font-medium flex items-center space-x-2">
                <i className="fas fa-triangle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-kameya-burgundy text-white py-4 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-kameya-burgundy/20 disabled:opacity-60 active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center space-x-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Входимо...</span>
                </span>
              ) : (
                'Увійти'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Проблеми зі входом? Зверніться до адміністратора.
        </p>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test in browser**

Start both servers:
```bash
# Terminal 1
cd /Users/Apple/IT/mysteryshopperKameya/backend && npm run dev

# Terminal 2
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npm run dev
```

Open `http://localhost:5173` (or whichever port Vite uses). Verify:
1. "Забули пароль?" link appears to the right of the "Пароль" label
2. Clicking it opens the modal with a phone input field
3. Entering a non-existent phone → step 2 appears (no error leak)
4. Entering a real phone → SMS arrives with code
5. Wrong code → error message, modal stays open
6. Correct code → step 3 (new password fields)
7. Password < 8 chars → validation error
8. Passwords don't match → validation error
9. Valid matching passwords → success screen with checkmark
10. "До входу" button closes modal, login page is shown
11. Logging in with the new password succeeds
12. Closing modal at any step resets all fields when reopened

- [ ] **Step 4: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat: add forgot password link and modal to login page"
```
