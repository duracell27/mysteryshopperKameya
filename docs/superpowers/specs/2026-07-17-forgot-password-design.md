# Forgot Password Flow — Design Spec

**Date:** 2026-07-17  
**Status:** Approved

## Problem

All existing password reset endpoints (`/api/auth/request-reset-code`, `/api/auth/verify-reset-code`, `/api/auth/confirm-reset`) require `authMiddleware` — they take the phone number from the JWT token. Users who are not logged in and don't remember their password have no way to reset it. The login page shows only "Contact an administrator."

## Goal

Add a "Забули пароль?" (Forgot Password) link on the login page that lets an unauthenticated user reset their password via SMS OTP, using the same 3-step flow that exists for logged-in users. After a successful reset the user is redirected to the login page to log in with their new password.

## Approach

Three new unauthenticated backend endpoints + a new modal component on the login page. The existing authenticated endpoints are untouched.

---

## Backend

**File:** `backend/src/routes/auth.ts`

Three new routes, no `authMiddleware`:

| Route | Body | Behaviour |
|---|---|---|
| `POST /api/auth/forgot/request` | `{ phone }` | Normalize phone, find user (404 if not found), generate 6-digit code, store in `resetCodes` Map with 10-min expiry, send SMS |
| `POST /api/auth/forgot/verify` | `{ phone, code }` | Look up code by normalized phone, check expiry and value. Return 200 on match — do NOT delete the code yet (needed for confirm) |
| `POST /api/auth/forgot/confirm` | `{ phone, code, newPassword }` | Re-validate code (expiry + value), hash and save new password, delete code from Map, log `password_changed` |

**Security notes:**
- Return a generic error (not "user not found") if the phone doesn't exist, to avoid user enumeration.
- Delete the code from the Map after any wrong-code attempt (same behaviour as the authenticated flow).
- Minimum password length: 8 characters (same as authenticated flow).
- The shared `resetCodes` Map uses normalized phone as key — no conflict with the authenticated flow since both normalize the same way.

---

## Frontend

### `forgotPasswordService.ts` (new file)

Location: `frontend/src/services/forgotPasswordService.ts`

Three functions using `apiFetch` without an Authorization header:
- `requestForgotCode(phone: string): Promise<void>`
- `verifyForgotCode(phone: string, code: string): Promise<void>`
- `confirmForgotPassword(phone: string, code: string, newPassword: string): Promise<void>`

### `ForgotPasswordModal.tsx` (new component)

Location: `frontend/src/components/ForgotPasswordModal.tsx`

3-step modal, rendered via `ReactDOM.createPortal` (same pattern as `ChangePasswordModal`):

- **Step 1** — Phone number input field + "Надіслати код" button. On submit: call `requestForgotCode`, advance to step 2.
- **Step 2** — 6-digit SMS code input (same styling as `ChangePasswordModal` step 2). "Надіслати повторно" resend button. On submit: call `verifyForgotCode`, advance to step 3.
- **Step 3** — New password + confirm password fields (same styling as `ChangePasswordModal` step 3). On submit: call `confirmForgotPassword`. On success: show inline success message "Пароль змінено. Увійдіть з новим паролем." and close modal after 2 seconds.

State resets on modal close (same `useEffect` pattern as `ChangePasswordModal`).

### `LoginPage.tsx` (small change)

Add a "Забули пароль?" text button link below the password field, styled in `kameya-burgundy`. Clicking it opens `ForgotPasswordModal`. The modal receives `open` and `onClose` props managed by local state in `LoginPage`.

---

## Out of Scope

- Rate limiting on the new endpoints (not in existing flow either)
- Email-based reset (app uses SMS only)
- Auto-login after reset (user confirmed: redirect to login instead)
