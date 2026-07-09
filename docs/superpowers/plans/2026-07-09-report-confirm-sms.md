# Report Confirm + SMS Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a confirmation modal before saving a report that previews points awarded and lets admin opt out of SMS notification to the employee.

**Architecture:** Intercept the confirm button in `ReportsUploadView.tsx` with a modal; pass `sendSmsNotification: boolean` to the existing `POST /api/reports/confirm` endpoint; backend sends SMS fire-and-forget and returns `smsSent: boolean`; done screen displays SMS status.

**Tech Stack:** React + TypeScript (frontend), Express + TypeScript (backend), SMSClub via `backend/src/services/sms.ts`

## Global Constraints

- SMS text (exact): `'У вас доступна нова анкета для перегляду.\nmysteryshopper.kameya.if.ua'`
- SMS phone format: `'38' + user.phone` (matches pattern in `backend/src/routes/users.ts:70`)
- SMS failure is non-blocking — report is already saved, only `smsSent: false` is returned
- Points formula matches `backend/src/services/pointsService.ts:calculatePoints` exactly
- `smsEnabled` defaults to `true` in the modal
- Checkbox must be unchecked by admin to suppress SMS — default is to send

---

### Task 1: Backend — extend confirm endpoint with SMS

**Files:**
- Modify: `backend/src/routes/reports.ts:233-329` (the `POST /api/reports/confirm` handler)

**Interfaces:**
- Consumes: `req.body.sendSmsNotification: boolean | undefined`
- Produces: response now includes `smsSent: boolean` alongside existing `pointsAwarded`, `totalPoints`

- [ ] **Step 1: Add `sendSms` import at the top of `routes/reports.ts`**

The file already imports from many places. Add `sendSms` import after the existing imports (around line 14):

```ts
import { sendSms } from '../services/sms';
```

- [ ] **Step 2: Extend the confirm handler to read `sendSmsNotification` and send SMS**

In `POST /api/reports/confirm`, after the line `await syncStreakBonuses(userId, Number(year));` (around line 285) and before the `badgeOverride` block, insert the SMS block:

```ts
const sendSmsNotification = req.body.sendSmsNotification === true;
let smsSent = false;

if (sendSmsNotification && user?.phone) {
  try {
    await sendSms(
      '38' + user.phone,
      'У вас доступна нова анкета для перегляду.\nmysteryshopper.kameya.if.ua',
    );
    smsSent = true;
  } catch (err) {
    console.error('[SMS] Не вдалось надіслати повідомлення про нову анкету:', err);
    smsSent = false;
  }
}
```

- [ ] **Step 3: Include `smsSent` in the response**

The final `return res.status(201).json(...)` line currently returns:
```ts
return res.status(201).json({ ...report.toObject(), pointsAwarded, totalPoints });
```

Change it to:
```ts
return res.status(201).json({ ...report.toObject(), pointsAwarded, totalPoints, smsSent });
```

- [ ] **Step 4: Build the backend to verify no TypeScript errors**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors printed.

- [ ] **Step 5: Manual verify — confirm without SMS**

With the backend running, call the confirm endpoint with `sendSmsNotification: false` and check that `smsSent: false` comes back. You can use a test report or the existing dev flow. The key check: no SMS is attempted (check backend console for absence of `[SMS]` log line), and `smsSent` field exists in the JSON response.

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/routes/reports.ts
git commit -m "feat: extend confirm endpoint with optional SMS notification"
```

---

### Task 2: Frontend service types

**Files:**
- Modify: `frontend/src/services/reportsService.ts`

**Interfaces:**
- Produces:
  - `ConfirmReportPayload.sendSmsNotification?: boolean`
  - `ConfirmReportResponse.smsSent: boolean`

- [ ] **Step 1: Add `sendSmsNotification` to `ConfirmReportPayload`**

In `reportsService.ts`, find `ConfirmReportPayload` (around line 34). Add the field:

```ts
export interface ConfirmReportPayload {
  userId: string;
  auditId: string;
  location: string;
  date: string;
  totalScore: number;
  sections: AuditResult['sections'];
  fileName: string;
  quarter: string;
  year: number;
  month?: number;
  affirmation?: string;
  badgeOverride?: { action: 'cancel' } | { action: 'custom'; badgeIds: BadgeId[] };
  sendSmsNotification?: boolean;
}
```

- [ ] **Step 2: Add `smsSent` to `ConfirmReportResponse`**

Find `ConfirmReportResponse` (around line 56). Add the field:

```ts
export interface ConfirmReportResponse extends AuditResult {
  pointsAwarded: number;
  totalPoints: number;
  smsSent: boolean;
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/services/reportsService.ts
git commit -m "feat: add sendSmsNotification and smsSent to report service types"
```

---

### Task 3: Frontend component — confirmation modal + done screen

**Files:**
- Modify: `frontend/src/components/admin/ReportsUploadView.tsx`

**Interfaces:**
- Consumes:
  - `ConfirmReportPayload.sendSmsNotification?: boolean` (from Task 2)
  - `ConfirmReportResponse.smsSent: boolean` (from Task 2)
- Produces: visual modal before save, SMS status on done screen

- [ ] **Step 1: Add `calculatePoints` helper at the top of the file (after imports)**

Add this function before the `MONTHS_UK` constant:

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

- [ ] **Step 2: Add new state variables**

Inside `ReportsUploadView`, after the existing `const [userBadgeIds, setUserBadgeIds] = useState<BadgeId[]>([]);` line, add:

```ts
const [showConfirmModal, setShowConfirmModal] = useState(false);
const [smsEnabled, setSmsEnabled] = useState(true);
const [smsSent, setSmsSent] = useState<boolean | null>(null);
```

- [ ] **Step 3: Change `handleConfirm` to accept a `sendSms` parameter**

Find `handleConfirm`:
```ts
const handleConfirm = async () => {
```

Change the signature to:
```ts
const handleConfirm = async (sendSmsNotification: boolean) => {
```

Then inside, in the `confirmReport(...)` call, add the new field. The call currently ends with:
```ts
      ...(badgeOverride ? { badgeOverride } : {}),
```

Change to:
```ts
      ...(badgeOverride ? { badgeOverride } : {}),
      sendSmsNotification,
```

Then where `setAwardedPoints(result.pointsAwarded)` is called (after `const result = await confirmReport(...)`), add:
```ts
      setAwardedPoints(result.pointsAwarded);
      setSmsSent(result.smsSent ?? false);
```

- [ ] **Step 4: Add `openConfirmModal` helper**

Add this function after `handleConfirm`:

```ts
const openConfirmModal = () => {
  setSmsEnabled(true);
  setShowConfirmModal(true);
};
```

- [ ] **Step 5: Update `handleReset` to clear new state**

Find `handleReset`. Add these resets inside it, alongside the existing ones:

```ts
    setShowConfirmModal(false);
    setSmsEnabled(true);
    setSmsSent(null);
```

- [ ] **Step 6: Replace `handleConfirm` calls with `openConfirmModal` in the preview buttons**

There are two "Підтвердити та зберегти" buttons:

**Button 1** — in the detailed preview section (`showDetailedPreview && parsed`), around line 260:
```tsx
onClick={handleConfirm}
```
Change to:
```tsx
onClick={openConfirmModal}
```

**Button 2** — in the main preview section (step === 'preview' || step === 'saving'), around line 657:
```tsx
onClick={handleConfirm}
```
Change to:
```tsx
onClick={openConfirmModal}
```

- [ ] **Step 7: Add the confirmation modal JSX**

Place it as the **very first** conditional return in the component — before the `if (step === 'done')` block. This ensures the modal overlay appears on top of any active screen (done, detailed preview, or preview):

```tsx
  // ── Confirm modal ──
  if (showConfirmModal && parsed) {
    const pts = calculatePoints(parsed.totalScore);
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-800">Підтвердити збереження?</h2>

          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Працівник</span>
              <span className="font-semibold text-slate-800">{selectedEmployee?.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Результат</span>
              <span className="font-semibold text-slate-800">{Math.round(parsed.totalScore)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Нарахується</span>
              <span className={`font-semibold ${pts > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                {pts > 0 ? `+${pts} балів` : 'Бали не нараховуються'}
              </span>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-kameya-burgundy"
            />
            <span className="text-sm text-slate-700">
              Сповістити працівника про нову анкету через SMS
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
            >
              Скасувати
            </button>
            <button
              onClick={() => {
                setShowConfirmModal(false);
                handleConfirm(smsEnabled);
              }}
              className="flex-1 py-2.5 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors"
            >
              Підтвердити
            </button>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 8: Add SMS status to the done screen**

Find the done screen (the `if (step === 'done')` block). After the existing `awardedPoints` badge div, add the SMS status line:

```tsx
        {smsSent !== null && (
          <div className={`px-6 py-3 rounded-xl text-sm font-semibold ${
            smsSent
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-slate-50 text-slate-500 border border-slate-200'
          }`}>
            {smsSent
              ? <><i className="fas fa-comment-sms mr-2"></i>SMS-сповіщення надіслано</>
              : 'SMS не надсилалось'}
          </div>
        )}
```

- [ ] **Step 9: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Manual end-to-end test**

1. Start backend (`cd backend && npm run dev`) and frontend (`cd frontend && npm run dev`)
2. Log in as admin, go to "Завантаження звітів"
3. Select an employee and upload a PDF
4. After parsing, click "Підтвердити та зберегти"
5. **Verify:** Modal appears with employee name, score %, correct points amount
6. **Verify:** SMS checkbox is checked by default
7. Uncheck the SMS checkbox, click "Підтвердити"
8. **Verify:** Done screen shows "+X балів нараховано" and "SMS не надсилалось"
9. Upload another report, confirm with checkbox **checked**
10. **Verify:** Done screen shows "SMS-сповіщення надіслано"
11. **Verify:** Backend console shows `[SMS] Надіслано на 38XXXXXXXXX`

- [ ] **Step 11: Commit**

```bash
cd frontend
git add src/components/admin/ReportsUploadView.tsx
git commit -m "feat: add confirmation modal with SMS opt-out before saving report"
```
