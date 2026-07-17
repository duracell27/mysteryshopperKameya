# Password Reset via SMS — Design Spec

**Date:** 2026-07-17  
**Scope:** Self-service password change for both ADMIN and EMPLOYEE users via SMS OTP

---

## Overview

Logged-in users can change their password through a 3-step modal flow triggered from the profile area (sidebar on desktop, dropdown menu on mobile). Identity is verified by sending a 6-digit OTP to the user's registered phone number via SMSClub.

---

## Backend

### OTP Storage

An in-memory `Map<string, { code: string; expiry: number }>` keyed by normalized phone number. Codes expire after 10 minutes. No DB schema changes required.

### New endpoints in `backend/src/routes/auth.ts`

#### `POST /api/auth/request-reset-code`

- **Auth:** None (public)
- **Body:** `{ phone: string }`
- **Behavior:**
  1. Normalize the phone number
  2. Find the user by phone — if not found, return 404
  3. Generate a 6-digit numeric code
  4. Store `{ code, expiry: Date.now() + 10 * 60 * 1000 }` in the Map
  5. Send SMS: `"Камея: Ваш код для зміни пароля — XXXXXX. Дійсний 10 хвилин."`
  6. Return 200 `{ message: 'Код надіслано' }`
- **Rate abuse:** Not addressed in this scope (admin-controlled user base, low traffic)

#### `POST /api/auth/confirm-reset`

- **Auth:** None (public)
- **Body:** `{ phone: string, code: string, newPassword: string }`
- **Behavior:**
  1. Normalize phone, look up entry in Map
  2. Return 400 if no entry or expired
  3. Return 400 if code does not match
  4. Validate `newPassword.length >= 8` — return 400 if not
  5. Hash new password with bcrypt (rounds: 12)
  6. Update user document
  7. Delete entry from Map
  8. Return 200 `{ message: 'Пароль змінено' }`

---

## Frontend

### New component: `frontend/src/components/ChangePasswordModal.tsx`

A portal-based modal (same pattern as `BadgesModal`) with 3 steps driven by local state.

#### Step 1 — Request code
- Heading: `"Зміна пароля"`
- Body text: `"Щоб змінити пароль, натисніть кнопку нижче. Ми надішлемо 6-значний код на ваш номер."`
- Shows user's phone (from `useAuth()`) in a muted label
- Button: `"Надіслати код на [phone]"` → calls `POST /api/auth/request-reset-code`
- On success: advance to step 2

#### Step 2 — Enter OTP
- Input: numeric only, max 6 digits, autofocus
- Button: `"Далі"` — enabled only when 6 digits entered
- On click: advance to step 3 (code is validated server-side in step 3, not here separately)

#### Step 3 — New password
- Input: `"Новий пароль"` (password type, show/hide toggle)
- Input: `"Підтвердження пароля"` (password type)
- Client-side validation before submit:
  - Both fields filled
  - `newPassword.length >= 8`
  - Passwords match
- Button: `"Зберегти"` → calls `POST /api/auth/confirm-reset` with `{ phone, code, newPassword }`
- On success: call `logout()` from `useAuth()` → app returns to `LoginPage`
- On error (wrong/expired code): show inline error, allow user to go back to step 1

### Error handling

- Network/server errors shown as inline red banners (same style as `LoginPage` error block)
- Loading spinners on action buttons while requests are in-flight
- Modal closable (✕ button) only in steps 1 and 2; in step 3 also closable (password not changed yet)

### Integration in `Layout.tsx`

- New optional prop `onChangePassword: () => void` passed from `App.tsx`
- **Desktop sidebar:** `"Змінити пароль"` button between system notifications button and `"Вийти"` button
- **Mobile dropdown:** `"Змінити пароль"` item above `"Вийти"` item

### State in `App.tsx`

```tsx
const [changePasswordOpen, setChangePasswordOpen] = useState(false);
// passed to Layout as onChangePassword={() => setChangePasswordOpen(true)}
// <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
```

---

## Validation Summary

| Rule | Where enforced |
|------|---------------|
| User exists | Backend request-reset-code |
| Code is 6 digits | Frontend (input constraint) + backend confirm-reset |
| Code not expired (10 min) | Backend confirm-reset |
| Code matches | Backend confirm-reset |
| Password ≥ 8 chars | Frontend + backend confirm-reset |
| Passwords match | Frontend only |

---

## Out of Scope

- Rate limiting / brute-force protection
- "Forgot password" from the login screen (user is not yet logged in)
- Email-based reset
