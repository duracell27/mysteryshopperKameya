# Affirmation for 100% Score Reports — Design Spec

**Date:** 2026-07-01

## Goal

When a mystery shopper report with `totalScore >= 100` is viewed by an employee, show a personalized affirmation text (from a fixed list of 18) with a subtle animated background of floating trophies and diamonds. The affirmation is assigned once at upload time and stored on the report, ensuring no repeats within a 12-month window per employee.

---

## Backend

### 1. New field on Report model

Add to `IReport` interface and `ReportSchema` in `backend/src/models/Report.ts`:

```typescript
affirmation?: string;
```

Mongoose schema entry:
```typescript
affirmation: { type: String },
```

### 2. Affirmations constant

New file: `backend/src/constants/affirmations.ts`

Contains an exported array `AFFIRMATIONS: string[]` with all 18 texts (verbatim, in order):

1. «100% — це не випадковість, а звичка. Так тримати.»
2. «Таємний покупець зустрів профі. Респект.»
3. «Бездоганно. Саме так і виглядає сервіс рівня Камея.»
4. «Клієнт пішов із відчуттям, що його тут справді чекали. Це твоя робота.»
5. «Сьогодні хтось пішов із салону з гарним настроєм — і це завдяки тобі.»
6. «Є люди, які продають прикраси. А є ти — той, хто створює враження.»
7. «Найкращий комплімент від клієнта — це коли він повертається. Ти на правильному шляху.»
8. «100%. Навіть Таємний покупець залишився без таємниць — ти все зробила як треба.»
9. «Якби сервіс можна було носити як прикрасу — твій сяяв би найяскравіше.»
10. «Ідеальна анкета. Десь там НР зараз посміхається.»
11. «Рівень: золото. Як і все, що ми продаємо.»
12. «Ще один ідеальний результат у твою колекцію. Скільки буде наступного разу?»
13. «Серія триває. Ти набираєш обертів — і бали теж.»
14. «Ти щойно зробила ще один крок до топової позиції в мережі.»
15. «Твій салон може пишатись — ти підняла планку ще вище.»
16. «Це не просто бал. Це доказ, що стандарт Камея — твій стандарт теж.»
17. «Бездоганно. ✨»
18. «Чисто. Точно. Камея. 💎»

### 3. Assignment logic (report upload handler)

Location: `backend/src/routes/reports.ts` — POST handler that creates/saves a report.

When `totalScore >= 100` and before saving the report document:

1. Query `Report.find({ userId, totalScore: { $gte: 100 }, affirmation: { $exists: true }, date: { $gte: <12 months ago> } })` — get used affirmations for this user in the past 12 months
2. Collect the set of used affirmation strings
3. Build `available = AFFIRMATIONS.filter(a => !usedSet.has(a))`
4. If `available.length === 0`, reset: `available = AFFIRMATIONS` (cycle)
5. Pick `available[Math.floor(Math.random() * available.length)]`
6. Set `report.affirmation = picked`

The `date` field on Report is a string (`"YYYY-MM-DD"` format). The 12-month cutoff is computed as `new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1)` then formatted to compare as string.

---

## Frontend

### 1. Type update

In `frontend/src/types.ts`, add to `AuditResult`:
```typescript
affirmation?: string;
```

### 2. Affirmation card (MyReportsView.tsx)

Replace the current green "Ідеальний результат! 🎉" banner with an affirmation card.

Condition: `selected.totalScore >= 100 && selected.affirmation`

Card design:
- Dark background: `bg-slate-800` or `bg-kameya-burgundy` (burgundy preferred — matches brand)
- White text, centered, `text-lg font-semibold italic`
- `rounded-2xl`, `px-6 py-6`, `relative overflow-hidden`
- Floating icons rendered as absolutely-positioned `<span>` elements inside the card
- 12 spans total: 6 × 🏆, 6 × 💎, random horizontal positions via inline `left` style, staggered `animation-delay`

### 3. Animated background (index.css)

CSS keyframes `floatUp`:
```css
@keyframes floatUp {
  0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.10; }
  90%  { opacity: 0.10; }
  100% { transform: translateY(-120px) rotate(15deg); opacity: 0; }
}
```

Utility class `.float-icon`:
```css
.float-icon {
  position: absolute;
  bottom: -10px;
  font-size: 1.5rem;
  animation: floatUp 4s ease-in-out infinite;
  pointer-events: none;
  user-select: none;
}
```

Each span gets `animation-delay` from 0s to 3.5s in steps, and a random `left` percentage (5%, 15%, 25%, 40%, 55%, 65%, 75%, 85%, 90% etc.) spread across the card width.

### 4. Confetti

Remains unchanged — fires from `useEffect` at top level of component when `selected.totalScore >= 100`.

---

## Boundaries

- No new API endpoints — affirmation is set during existing upload flow
- No frontend changes to the upload view
- The animated background is pure CSS — no new libraries
- The affirmation card replaces only the green banner; all other report sections are untouched
