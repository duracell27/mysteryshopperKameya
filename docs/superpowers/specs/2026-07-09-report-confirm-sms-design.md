---
name: report-confirm-sms
description: Confirmation modal before saving report with SMS notification option
metadata:
  type: project
---

# Report Confirm + SMS Notification — Design Spec

**Date:** 2026-07-09

## Overview

When an admin saves a mystery shopper report, a confirmation modal appears before the report is persisted. The modal shows how many points will be awarded and offers an opt-out checkbox for SMS notification to the employee. After saving, the done screen reflects whether the SMS was sent.

## User Flow

1. Admin parses PDF, reviews the preview (or detailed preview)
2. Admin clicks "Підтвердити та зберегти"
3. **Confirmation modal appears** (blocking the save)
4. Admin optionally unchecks the SMS checkbox
5. Admin clicks "Підтвердити" → report saves, SMS sent if checkbox was on
6. Done screen shows points awarded + SMS sent/not sent status

## Frontend Changes — `ReportsUploadView.tsx`

### New state
```ts
const [showConfirmModal, setShowConfirmModal] = useState(false);
const [smsEnabled, setSmsEnabled] = useState(true);
const [smsSent, setSmsSent] = useState<boolean | null>(null);
```

### `calculatePoints` helper (replicated from backend)
```ts
function calculatePoints(score: number): number {
  const f = Math.floor(score);
  if (f === 100) return 100;
  if (f >= 97)   return 55;
  if (f >= 93)   return 35;
  if (f >= 88)   return 18;
  if (f >= 80)   return 8;
  if (f >= 70)   return 2;
  return 0;
}
```

### Button behavior change
Both "Підтвердити та зберегти" buttons (preview and detailed preview) call `openConfirmModal()` instead of `handleConfirm()` directly.

`openConfirmModal()` sets `showConfirmModal = true`.

### Modal UI
- Employee name + score + calculated points display
- Checkbox "Сповістити про нову анкету через SMS" — default checked
- "Скасувати" button: closes modal, stays on preview
- "Підтвердити" button: calls `handleConfirm(smsEnabled)`, closes modal

### `handleConfirm(sendSms: boolean)` change
Passes `sendSmsNotification: sendSms` in the confirm payload. Stores `smsSent` from the API response.

### Done screen additions
Below the existing "+X балів нараховано" badge:
- `smsSent === true` → green badge "SMS-сповіщення надіслано"
- `smsSent === false` → grey text "SMS не надсилалось"

### Reset
`handleReset()` also resets `showConfirmModal`, `smsEnabled` (back to `true`), `smsSent`.

## Frontend Changes — `reportsService.ts`

`ConfirmReportPayload` gets a new optional field:
```ts
sendSmsNotification?: boolean;
```

`ConfirmReportResponse` gets:
```ts
smsSent: boolean;
```

## Backend Changes — `routes/reports.ts` (`POST /api/reports/confirm`)

After `awardPoints` and streak sync, if `sendSmsNotification === true`:

```ts
const { sendSmsNotification } = req.body;
let smsSent = false;

if (sendSmsNotification) {
  try {
    await sendSms(
      '38' + user.phone,
      'У вас доступна нова анкета для перегляду.\nmystershopper.kameya.if.ua'
    );
    smsSent = true;
  } catch (err) {
    console.error('[SMS] Не вдалось надіслати:', err);
    smsSent = false;
  }
}
```

Response includes `smsSent: boolean` alongside existing `pointsAwarded` and `totalPoints`.

### Phone format
User phone is stored as `0XXXXXXXXX` (10 digits). SMS service expects `38XXXXXXXXX`. Prepend `'38'` as done in `users.ts`.

### Error handling
SMS failure is non-blocking — report is already saved. Only `smsSent: false` is returned; no 500 error.

## SMS Text
```
У вас доступна нова анкета для перегляду.
mysteryshopper.kameya.if.ua
```

No points or score mentioned — employee logs in to see details.

## Files Changed
- `frontend/src/components/admin/ReportsUploadView.tsx`
- `frontend/src/services/reportsService.ts`
- `backend/src/routes/reports.ts`
