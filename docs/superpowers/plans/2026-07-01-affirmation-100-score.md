# Affirmation for 100% Score Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assign a unique affirmation text (from a fixed list of 18) to each 100% mystery shopper report at upload time, persist it on the report document, and display it with a floating 🏆💎 animated background when the employee views the report.

**Architecture:** Backend — new `affirmations.ts` constant + `affirmation` field on the Report model + selection logic injected into the existing `POST /api/reports/confirm` handler. Frontend — `AuditResult` type gets `affirmation?: string`, the existing green banner in `MyReportsView.tsx` is replaced with a branded card with floating icons, animation defined in `index.css`.

**Tech Stack:** Node.js/Express, Mongoose/MongoDB, React 18, TypeScript, Tailwind CSS

## Global Constraints

- No new API endpoints — affirmation is set inside the existing `POST /api/reports/confirm` handler
- No new npm packages
- All 18 affirmation strings must be stored verbatim (Ukrainian text, including punctuation and emoji)
- Affirmation assigned only when `totalScore >= 100`
- No repeats within 12 months per user; cycle back to all 18 if all used
- The animated background uses pure CSS — no JS animation libraries
- Confetti `useEffect` in `MyReportsView.tsx` must remain untouched

---

### Task 1: Backend — affirmations constant + Report model field

**Files:**
- Create: `backend/src/constants/affirmations.ts`
- Modify: `backend/src/models/Report.ts`

**Interfaces:**
- Produces: `AFFIRMATIONS: string[]` exported from `backend/src/constants/affirmations.ts`
- Produces: `affirmation?: string` on `IReport` interface and `ReportSchema`

- [ ] **Step 1: Create the affirmations constant file**

Create `backend/src/constants/affirmations.ts` with this exact content:

```typescript
export const AFFIRMATIONS: string[] = [
  '«100% — це не випадковість, а звичка. Так тримати.»',
  '«Таємний покупець зустрів профі. Респект.»',
  '«Бездоганно. Саме так і виглядає сервіс рівня Камея.»',
  '«Клієнт пішов із відчуттям, що його тут справді чекали. Це твоя робота.»',
  '«Сьогодні хтось пішов із салону з гарним настроєм — і це завдяки тобі.»',
  '«Є люди, які продають прикраси. А є ти — той, хто створює враження.»',
  '«Найкращий комплімент від клієнта — це коли він повертається. Ти на правильному шляху.»',
  '«100%. Навіть Таємний покупець залишився без таємниць — ти все зробила як треба.»',
  '«Якби сервіс можна було носити як прикрасу — твій сяяв би найяскравіше.»',
  '«Ідеальна анкета. Десь там НР зараз посміхається.»',
  '«Рівень: золото. Як і все, що ми продаємо.»',
  '«Ще один ідеальний результат у твою колекцію. Скільки буде наступного разу?»',
  '«Серія триває. Ти набираєш обертів — і бали теж.»',
  '«Ти щойно зробила ще один крок до топової позиції в мережі.»',
  '«Твій салон може пишатись — ти підняла планку ще вище.»',
  '«Це не просто бал. Це доказ, що стандарт Камея — твій стандарт теж.»',
  '«Бездоганно. ✨»',
  '«Чисто. Точно. Камея. 💎»',
];
```

- [ ] **Step 2: Add `affirmation` to IReport interface**

Open `backend/src/models/Report.ts`. In the `IReport` interface (around line 59), add after `learningPlan?`:

```typescript
  affirmation?: string;
```

- [ ] **Step 3: Add `affirmation` to ReportSchema**

In the same file, in `ReportSchema` (around line 143), add after the `learningPlan` entry:

```typescript
  affirmation: { type: String },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add backend/src/constants/affirmations.ts backend/src/models/Report.ts
git commit -m "feat: add affirmations constant and affirmation field to Report model"
```

---

### Task 2: Backend — affirmation selection in POST /confirm handler

**Files:**
- Modify: `backend/src/routes/reports.ts`

**Interfaces:**
- Consumes: `AFFIRMATIONS` from `../constants/affirmations` (Task 1)
- Consumes: `IReport.affirmation?: string` (Task 1)
- The handler is `router.post('/confirm', ...)` at line 223. The `Report.create()` call is at line 238.

- [ ] **Step 1: Add the import**

At the top of `backend/src/routes/reports.ts`, after the existing imports, add:

```typescript
import { AFFIRMATIONS } from '../constants/affirmations';
```

- [ ] **Step 2: Add the affirmation selection logic**

Inside `router.post('/confirm', ...)`, replace the `Report.create(...)` block (lines 238–243) with the following. This adds selection logic before creation:

```typescript
    // Assign affirmation for perfect score
    let affirmation: string | undefined;
    if (totalScore >= 100) {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const cutoffStr = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"
      const recentPerfect = await Report.find(
        { userId, totalScore: { $gte: 100 }, affirmation: { $exists: true, $ne: null }, date: { $gte: cutoffStr } },
        'affirmation'
      ).lean();
      const usedSet = new Set(recentPerfect.map((r) => r.affirmation as string));
      let available = AFFIRMATIONS.filter((a) => !usedSet.has(a));
      if (available.length === 0) available = AFFIRMATIONS;
      affirmation = available[Math.floor(Math.random() * available.length)];
    }

    const report = await Report.create({
      userId, auditId, location, store, date,
      quarter, year: Number(year),
      ...(month !== undefined && { month: Number(month) }),
      totalScore, sections, fileName,
      ...(affirmation !== undefined && { affirmation }),
    });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add backend/src/routes/reports.ts
git commit -m "feat: assign affirmation to 100% reports on upload, no repeats within 12 months"
```

---

### Task 3: Frontend — type, affirmation card, floating animation

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/employee/MyReportsView.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `affirmation?: string` on `AuditResult` (added in this task)
- Consumes: `selected.totalScore`, `selected.affirmation` in `MyReportsView.tsx`

- [ ] **Step 1: Add `affirmation` to AuditResult type**

Open `frontend/src/types.ts`. Find the `AuditResult` interface. Add `affirmation?: string` to it. Example — if the interface looks like:

```typescript
export interface AuditResult {
  _id?: string;
  id?: string;
  // ... other fields ...
  learningPlan?: LearningPlan;
  createdAt?: string;
}
```

Add after `learningPlan?`:

```typescript
  affirmation?: string;
```

- [ ] **Step 2: Add floating animation CSS**

Open `frontend/src/index.css`. At the end of the file, add:

```css
@keyframes floatUp {
  0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.10; }
  90%  { opacity: 0.10; }
  100% { transform: translateY(-130px) rotate(15deg); opacity: 0; }
}

.float-icon {
  position: absolute;
  bottom: -10px;
  font-size: 1.4rem;
  animation: floatUp 4s ease-in-out infinite;
  pointer-events: none;
  user-select: none;
}
```

- [ ] **Step 3: Replace green banner with affirmation card in MyReportsView.tsx**

Open `frontend/src/components/employee/MyReportsView.tsx`.

Find the current banner block (added in the previous feature). It looks like:

```tsx
        {selected.totalScore >= 100 && (
          <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-6 py-4">
            <span className="text-2xl">🎉</span>
            <p className="text-green-700 font-bold text-lg">Ідеальний результат!</p>
            <span className="text-2xl">🎉</span>
          </div>
        )}
```

Replace it entirely with:

```tsx
        {selected.totalScore >= 100 && selected.affirmation && (
          <div className="relative overflow-hidden bg-kameya-burgundy rounded-2xl px-6 py-6 text-center">
            {[
              { icon: '🏆', left: '5%',  delay: '0s'    },
              { icon: '💎', left: '15%', delay: '0.6s'  },
              { icon: '🏆', left: '28%', delay: '1.2s'  },
              { icon: '💎', left: '40%', delay: '0.3s'  },
              { icon: '🏆', left: '52%', delay: '1.8s'  },
              { icon: '💎', left: '63%', delay: '0.9s'  },
              { icon: '🏆', left: '74%', delay: '2.4s'  },
              { icon: '💎', left: '83%', delay: '1.5s'  },
              { icon: '🏆', left: '90%', delay: '0.5s'  },
              { icon: '💎', left: '96%', delay: '2.1s'  },
            ].map((item, i) => (
              <span
                key={i}
                className="float-icon"
                style={{ left: item.left, animationDelay: item.delay }}
              >
                {item.icon}
              </span>
            ))}
            <p className="relative z-10 text-white text-lg font-semibold italic leading-relaxed">
              {selected.affirmation}
            </p>
          </div>
        )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npm run dev
```

1. Log in as admin, upload a report with `totalScore = 100` via the upload flow.
2. Log in as the target employee, open the report.
3. Verify:
   - Burgundy card appears below the score bar
   - Affirmation text is displayed in white italic
   - 🏆 and 💎 icons float upward at staggered intervals
   - Confetti bursts still fire from both sides on open
   - Reports with score < 100 show no card (card condition requires both `>= 100` AND `affirmation` present)
4. Upload a second 100% report for the same user. Verify the second report shows a **different** affirmation text.

- [ ] **Step 6: Commit**

```bash
cd /Users/Apple/IT/mysteryshopperKameya
git add frontend/src/types.ts frontend/src/components/employee/MyReportsView.tsx frontend/src/index.css
git commit -m "feat: show affirmation card with floating trophy/diamond animation on 100% reports"
```
