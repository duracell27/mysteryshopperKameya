# Score Insight + AI Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Незабаром" placeholder card on the employee dashboard with a score-aware block that generates AI recommendations via Claude API (once, on first view), prompts the consultant to respond, and surfaces results in the admin report detail view.

**Architecture:** Two embedded subdocuments are added to the `Report` mongoose model — `aiRecommendations` (written by Claude on first dashboard open) and `scoreInsight` (written by the employee). The frontend `ScoreInsightCard` component detects which subdocument exists and renders the appropriate state. Admin sees both in the report detail view and can manually trigger generation.

**Tech Stack:** Express + Mongoose (backend), React + TypeScript + Tailwind (frontend), `@anthropic-ai/sdk` (already installed in backend).

**Spec:** `docs/superpowers/specs/2026-04-22-score-insight-design.md`

---

## File Map

| Action | File |
|--------|------|
| Modify | `backend/src/models/Report.ts` |
| Modify | `backend/src/routes/reports.ts` |
| Modify | `frontend/src/types.ts` |
| Modify | `frontend/src/services/reportsService.ts` |
| Create | `frontend/src/components/employee/ScoreInsightCard.tsx` |
| Modify | `frontend/src/components/Dashboard.tsx` |
| Modify | `frontend/src/components/admin/AdminReportsListView.tsx` |

---

## Task 1: Backend model — add aiRecommendations and scoreInsight to Report

**Files:**
- Modify: `backend/src/models/Report.ts`

- [ ] **Step 1: Add interfaces after `IReflection`**

Open `backend/src/models/Report.ts`. After the `IReflection` interface (line 27), add:

```ts
interface IAiRecommendations {
  tier: 'below85' | 'range85to94' | 'range95to99';
  mainMessage: string;
  weakPoints: string[];
  question: string | null;
  generatedAt: Date;
}

interface IScoreInsight {
  tier: 'below85' | 'range85to94' | 'range95to99' | 'perfect100';
  goalText?: string;
  confirmedAt?: Date;
  whatHelpedText?: string;
  submittedAt: Date;
}
```

- [ ] **Step 2: Add fields to `IReport`**

Inside `IReport` (after `reflection?: IReflection;`), add:

```ts
aiRecommendations?: IAiRecommendations;
scoreInsight?: IScoreInsight;
```

- [ ] **Step 3: Add Mongoose schemas**

After `ReflectionSchema`, add:

```ts
const AiRecommendationsSchema = new Schema<IAiRecommendations>(
  {
    tier:        { type: String, required: true },
    mainMessage: { type: String, required: true },
    weakPoints:  [{ type: String }],
    question:    { type: String, default: null },
    generatedAt: { type: Date, required: true },
  },
  { _id: false }
);

const ScoreInsightSchema = new Schema<IScoreInsight>(
  {
    tier:            { type: String, required: true },
    goalText:        { type: String },
    confirmedAt:     { type: Date },
    whatHelpedText:  { type: String },
    submittedAt:     { type: Date, required: true },
  },
  { _id: false }
);
```

- [ ] **Step 4: Add fields to `ReportSchema`**

Inside the `ReportSchema` object (after `reflection`), add:

```ts
aiRecommendations: { type: AiRecommendationsSchema, default: undefined },
scoreInsight:      { type: ScoreInsightSchema, default: undefined },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/Report.ts
git commit -m "feat: add aiRecommendations and scoreInsight subdocuments to Report model"
```

---

## Task 2: Backend — POST /api/reports/:id/generate-ai

**Files:**
- Modify: `backend/src/routes/reports.ts`

- [ ] **Step 1: Add helper to build tier from score**

In `backend/src/routes/reports.ts`, after the imports block, add:

```ts
function getTier(score: number): 'below85' | 'range85to94' | 'range95to99' | 'perfect100' {
  if (score === 100) return 'perfect100';
  if (score >= 95) return 'range95to99';
  if (score >= 85) return 'range85to94';
  return 'below85';
}

function buildSectionsText(sections: { title: string; score: number; maxScore: number; questions: { question: string; isCorrect: boolean }[] }[]): string {
  return sections.map(s => {
    const pct = Math.round((s.score / s.maxScore) * 100);
    const failed = s.questions.filter(q => !q.isCorrect).map(q => q.question);
    const failedStr = failed.length > 0 ? `\n  Невиконані: ${failed.join('; ')}` : '';
    return `- ${s.title}: ${s.score}/${s.maxScore} (${pct}%)${failedStr}`;
  }).join('\n');
}
```

- [ ] **Step 2: Add the endpoint**

Add this route **before** `router.post('/:id/reflection', ...)` in `reports.ts`:

```ts
// POST /api/reports/:id/generate-ai — generate AI recommendations (employee or admin)
router.post('/:id/generate-ai', async (req: AuthRequest, res: Response) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    const isOwner = report.userId.toString() === req.user?.userId?.toString();
    const isAdmin = req.user?.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Доступ заборонено' });

    const tier = getTier(report.totalScore);
    if (tier === 'perfect100') {
      return res.status(400).json({ message: 'Для 100% рекомендації не генеруються' });
    }

    // Return existing if already generated
    if (report.aiRecommendations) {
      return res.json(report);
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sectionsText = buildSectionsText(report.sections as never);

    const prompt = `Ти — аналітик результатів таємного покупця ювелірного магазину.
Проаналізуй звіт і поверни ТІЛЬКИ валідний JSON без markdown та пояснень.

Загальна оцінка: ${report.totalScore}%
Тір: ${tier}
Секції:
${sectionsText}

Поверни JSON у форматі:
{
  "tier": "${tier}",
  "mainMessage": "...",
  "weakPoints": ["...", "..."],
  "question": "..." або null
}

Правила:
- weakPoints для below85: рівно 3 конкретні пункти, кожен починається з назви секції через двокрапку
- weakPoints для range85to94: рівно 1 пункт, починається з назви секції через двокрапку
- weakPoints для range95to99: порожній масив []
- mainMessage для below85: "Є над чим попрацювати — ось три точки зростання:"
- mainMessage для range85to94: "Один крок до відмінного результату:"
- mainMessage для range95to99: одне речення-привітання з результатом
- question для range95to99: "Що допомогло тобі досягти такого результату?"
- question для below85 та range85to94: null
- Всі тексти виключно українською мовою, конкретно, без загальних фраз`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(text);

    report.aiRecommendations = {
      tier: parsed.tier,
      mainMessage: parsed.mainMessage,
      weakPoints: parsed.weakPoints ?? [],
      question: parsed.question ?? null,
      generatedAt: new Date(),
    };
    await report.save();

    return res.json(report);
  } catch (error) {
    console.error('generate-ai error:', error);
    return res.status(500).json({ message: 'Помилка генерації рекомендацій' });
  }
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: add POST /api/reports/:id/generate-ai endpoint"
```

---

## Task 3: Backend — POST /api/reports/:id/score-insight

**Files:**
- Modify: `backend/src/routes/reports.ts`

- [ ] **Step 1: Add the endpoint**

Add this route directly after the `generate-ai` route:

```ts
// POST /api/reports/:id/score-insight — employee submits their response
router.post('/:id/score-insight', async (req: AuthRequest, res: Response) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    if (report.userId.toString() !== req.user?.userId?.toString()) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    if (report.scoreInsight) {
      return res.status(409).json({ message: 'Відповідь вже надіслано' });
    }

    const tier = getTier(report.totalScore);
    const { goalText, whatHelpedText } = req.body;

    if (tier === 'below85' && !goalText?.trim()) {
      return res.status(400).json({ message: 'Поле "ціль" обов\'язкове' });
    }
    if (tier === 'range95to99' && !whatHelpedText?.trim()) {
      return res.status(400).json({ message: 'Поле відповіді обов\'язкове' });
    }

    report.scoreInsight = {
      tier,
      ...(tier === 'below85' && { goalText: goalText.trim() }),
      ...(tier === 'range85to94' && { confirmedAt: new Date() }),
      ...(tier === 'range95to99' && { whatHelpedText: whatHelpedText.trim() }),
      submittedAt: new Date(),
    };
    await report.save();

    return res.json(report);
  } catch (error) {
    console.error('score-insight error:', error);
    return res.status(500).json({ message: 'Помилка збереження' });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: add POST /api/reports/:id/score-insight endpoint"
```

---

## Task 4: Frontend types — add AiRecommendations and ScoreInsight

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Add new interfaces**

In `frontend/src/types.ts`, after the `Reflection` interface (after line 107), add:

```ts
export interface AiRecommendations {
  tier: 'below85' | 'range85to94' | 'range95to99';
  mainMessage: string;
  weakPoints: string[];
  question: string | null;
  generatedAt: string;
}

export interface ScoreInsight {
  tier: 'below85' | 'range85to94' | 'range95to99' | 'perfect100';
  goalText?: string;
  confirmedAt?: string;
  whatHelpedText?: string;
  submittedAt: string;
}
```

- [ ] **Step 2: Add fields to AuditResult**

Inside `AuditResult` (after `reflection?: Reflection;`), add:

```ts
aiRecommendations?: AiRecommendations;
scoreInsight?: ScoreInsight;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add AiRecommendations and ScoreInsight types"
```

---

## Task 5: Frontend service — add generateAiRecommendations and submitScoreInsight

**Files:**
- Modify: `frontend/src/services/reportsService.ts`

- [ ] **Step 1: Add imports**

`ScoreInsight` is already exported from `types.ts` after Task 4. The import line at the top of `reportsService.ts` currently reads:

```ts
import { AuditResult, PointsTransaction } from '../types';
```

Change to:

```ts
import { AuditResult, PointsTransaction, ScoreInsight } from '../types';
```

- [ ] **Step 2: Add the two new service functions**

At the end of `reportsService.ts`, add:

```ts
export const generateAiRecommendations = async (reportId: string): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/generate-ai`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка генерації рекомендацій');
  }
  return res.json();
};

export const submitScoreInsight = async (
  reportId: string,
  data: Partial<Pick<ScoreInsight, 'goalText' | 'whatHelpedText'>>,
): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/score-insight`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка збереження відповіді');
  }
  return res.json();
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/reportsService.ts
git commit -m "feat: add generateAiRecommendations and submitScoreInsight service functions"
```

---

## Task 6: Create ScoreInsightCard component

**Files:**
- Create: `frontend/src/components/employee/ScoreInsightCard.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/components/employee/ScoreInsightCard.tsx` with the full content below:

```tsx
import React, { useEffect, useState } from 'react';
import { AuditResult } from '../../types';
import { generateAiRecommendations, submitScoreInsight } from '../../services/reportsService';

interface Props {
  lastAudit: AuditResult;
  allReports: AuditResult[];
  onInsightUpdated: (updated: AuditResult) => void;
}

export const ScoreInsightCard: React.FC<Props> = ({ lastAudit, allReports, onInsightUpdated }) => {
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [whatHelpedText, setWhatHelpedText] = useState('');

  const reportId = lastAudit._id ?? lastAudit.id ?? '';
  const score = lastAudit.totalScore;
  const isPerfect = score === 100;
  const ai = lastAudit.aiRecommendations;
  const insight = lastAudit.scoreInsight;
  const perfectCount = allReports.filter(r => r.totalScore === 100).length;

  // Trigger generation on first open (skip for 100%)
  useEffect(() => {
    if (isPerfect) return;
    if (ai) return;
    if (!reportId) return;

    setGenerating(true);
    generateAiRecommendations(reportId)
      .then(updated => onInsightUpdated(updated))
      .catch(err => setError(err.message))
      .finally(() => setGenerating(false));
  }, [reportId]);

  const handleSubmitGoal = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitScoreInsight(reportId, { goalText });
      onInsightUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitScoreInsight(reportId, {});
      onInsightUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWhatHelped = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitScoreInsight(reportId, { whatHelpedText });
      onInsightUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 100% — static celebration ──
  if (isPerfect) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-3">
        <div className="text-5xl">🏆</div>
        <p className="text-xl font-bold text-slate-800">Ідеальна перевірка!</p>
        <p className="text-sm text-slate-500">
          {perfectCount > 1 ? `Це твій ${perfectCount}-й результат 100%` : 'Перший результат 100% — неймовірно!'}
        </p>
        {!insight && (
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="mt-2 px-5 py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Зберігаємо...' : 'Відзначити досягнення'}
          </button>
        )}
        {insight && (
          <span className="text-xs text-green-600 flex items-center gap-1 font-semibold">
            <i className="fas fa-circle-check"></i> Зафіксовано
          </span>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  // ── Generating ──
  if (generating) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-3 min-h-[200px]">
        <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy"></i>
        <p className="text-sm font-medium text-slate-600">Обробляємо ваші рекомендації...</p>
        <p className="text-xs text-slate-400">Це займе кілька секунд</p>
      </div>
    );
  }

  // ── Error ──
  if (error && !ai) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col items-center justify-center text-center space-y-2 min-h-[200px]">
        <i className="fas fa-circle-exclamation text-2xl text-red-400"></i>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!ai) return null;

  const tier = ai.tier;

  // ── Submitted — read-only view ──
  if (insight) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Твій план росту</p>
        <p className="text-sm text-slate-600 font-medium">{ai.mainMessage}</p>
        {ai.weakPoints.length > 0 && (
          <ul className="space-y-2">
            {ai.weakPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <i className="fas fa-circle-arrow-right text-kameya-burgundy mt-0.5 flex-shrink-0"></i>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-slate-100 pt-3 space-y-1">
          {tier === 'below85' && insight.goalText && (
            <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Твоя ціль</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{insight.goalText}</p>
            </>
          )}
          {tier === 'range85to94' && insight.confirmedAt && (
            <p className="text-sm text-green-700 flex items-center gap-2 font-semibold">
              <i className="fas fa-circle-check text-green-500"></i>
              Ти підтвердив, що знаєш над чим працювати
            </p>
          )}
          {tier === 'range95to99' && insight.whatHelpedText && (
            <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Що допомогло</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{insight.whatHelpedText}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Ready for input ──
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Твій план росту</p>
      <p className="text-sm text-slate-600 font-medium">{ai.mainMessage}</p>

      {ai.weakPoints.length > 0 && (
        <ul className="space-y-2">
          {ai.weakPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <i className="fas fa-circle-arrow-right text-kameya-burgundy mt-0.5 flex-shrink-0"></i>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {tier === 'below85' && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Яка твоя ціль до наступної перевірки?
          </label>
          <textarea
            value={goalText}
            onChange={e => setGoalText(e.target.value)}
            rows={3}
            placeholder="Напиши конкретну ціль..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-kameya-burgundy"
          />
          <button
            onClick={handleSubmitGoal}
            disabled={submitting || !goalText.trim()}
            className="w-full py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Зберігаємо...' : 'Зафіксувати ціль'}
          </button>
        </div>
      )}

      {tier === 'range85to94' && (
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Зберігаємо...' : 'Розумію, буду працювати над цим'}
        </button>
      )}

      {tier === 'range95to99' && ai.question && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {ai.question}
          </label>
          <textarea
            value={whatHelpedText}
            onChange={e => setWhatHelpedText(e.target.value)}
            rows={3}
            placeholder="Поділись своїм досвідом..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-kameya-burgundy"
          />
          <button
            onClick={handleSubmitWhatHelped}
            disabled={submitting || !whatHelpedText.trim()}
            className="w-full py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Зберігаємо...' : 'Поділитись'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/employee/ScoreInsightCard.tsx
git commit -m "feat: add ScoreInsightCard component"
```

---

## Task 7: Integrate ScoreInsightCard into Dashboard

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Add import**

At the top of `Dashboard.tsx`, add after existing imports:

```ts
import { ScoreInsightCard } from './employee/ScoreInsightCard';
```

- [ ] **Step 2: Add state updater for lastAudit**

The `lastAudit` is currently stored as `useState`. When `ScoreInsightCard` gets an updated report back from the API, we need to update both `lastAudit` and the matching entry in `allReports`.

Add a handler after the `useEffect` block (around line 36):

```ts
const handleInsightUpdated = (updated: AuditResult) => {
  setLastAudit(updated);
  setAllReports(prev => prev.map(r =>
    (r._id ?? r.id) === (updated._id ?? updated.id) ? updated : r
  ));
};
```

- [ ] **Step 3: Replace the placeholder card**

Find the "Points Balance Card — placeholder" block (lines 92–96 in the original):

```tsx
{/* Points Balance Card — placeholder */}
<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center min-h-[160px]">
  <i className="fas fa-star text-slate-200 text-4xl mb-3"></i>
  <p className="text-slate-400 text-sm">Незабаром</p>
</div>
```

Replace with:

```tsx
{lastAudit ? (
  <ScoreInsightCard
    lastAudit={lastAudit}
    allReports={allReports}
    onInsightUpdated={handleInsightUpdated}
  />
) : (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center min-h-[160px]">
    <i className="fas fa-star text-slate-200 text-4xl mb-3"></i>
    <p className="text-slate-400 text-sm">Незабаром</p>
  </div>
)}
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Start dev server and verify the dashboard**

```bash
cd frontend && npm run dev
```

Open the dashboard as an employee with a recent report. Expected:
- If report < 100%: spinner "Обробляємо ваші рекомендації..." appears, then recommendations load
- If report = 100%: static celebration card with trophy shows immediately
- Refreshing the page: no spinner — recommendations load instantly from DB

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Dashboard.tsx
git commit -m "feat: integrate ScoreInsightCard into Dashboard"
```

---

## Task 8: Admin panel — show AI recommendations in report detail view

**Files:**
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

- [ ] **Step 1: Update ReportWithUser type**

At the top of `AdminReportsListView.tsx`, the `ReportWithUser` interface currently extends `AuditResult`. Since `AuditResult` now has `aiRecommendations` and `scoreInsight` (added in Task 4), no change is needed to the interface — the fields are inherited automatically.

- [ ] **Step 2: Add generateAiRecommendations import**

Change the import line:

```ts
import { getAllReports, deleteReport } from '../../services/reportsService';
```

to:

```ts
import { getAllReports, deleteReport, generateAiRecommendations } from '../../services/reportsService';
```

- [ ] **Step 3: Add state for AI generation in detail view**

Inside the component, after `const [reflectionReport, setReflectionReport] = useState<ReportWithUser | null>(null);`, add:

```ts
const [generatingAi, setGeneratingAi] = useState(false);
const [aiError, setAiError] = useState<string | null>(null);
```

- [ ] **Step 4: Add handler for admin-triggered generation**

After the `handleDelete` function, add:

```ts
const handleGenerateAi = async (report: ReportWithUser) => {
  const id = report._id ?? report.id ?? '';
  setGeneratingAi(true);
  setAiError(null);
  try {
    const updated = await generateAiRecommendations(id);
    setReports(prev => prev.map(r => (r._id ?? r.id) === id ? { ...r, ...updated } as ReportWithUser : r));
    setSelected(prev => prev && (prev._id ?? prev.id) === id ? { ...prev, ...updated } as ReportWithUser : prev);
  } catch (err) {
    setAiError(err instanceof Error ? err.message : 'Помилка генерації');
  } finally {
    setGeneratingAi(false);
  }
};
```

- [ ] **Step 5: Add AI recommendations panel in the detail view**

In the detail view section (the `if (selected)` block), after the closing `</div>` of the "Reflection panel" block (after line ~356 in original), add a new panel:

```tsx
{/* AI Recommendations panel */}
<div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
  <p className="text-sm font-semibold text-slate-700 mb-3">AI Рекомендації</p>
  {selected.totalScore === 100 ? (
    <p className="text-sm text-slate-500">100% — рекомендації не генеруються</p>
  ) : selected.aiRecommendations ? (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{selected.aiRecommendations.mainMessage}</p>
      {selected.aiRecommendations.weakPoints.length > 0 && (
        <ul className="space-y-1">
          {selected.aiRecommendations.weakPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <i className="fas fa-circle-arrow-right text-kameya-burgundy mt-0.5 flex-shrink-0 text-xs"></i>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
      {selected.scoreInsight && (
        <div className="border-t border-slate-100 pt-3 space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Відповідь консультанта</p>
          {selected.scoreInsight.goalText && (
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selected.scoreInsight.goalText}</p>
          )}
          {selected.scoreInsight.confirmedAt && (
            <p className="text-sm text-green-700 flex items-center gap-2">
              <i className="fas fa-circle-check text-green-500"></i>
              Підтвердив розуміння
            </p>
          )}
          {selected.scoreInsight.whatHelpedText && (
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selected.scoreInsight.whatHelpedText}</p>
          )}
        </div>
      )}
      {!selected.scoreInsight && (
        <p className="text-xs text-slate-400">Консультант ще не відповів</p>
      )}
    </div>
  ) : (
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-400">Консультант ще не відкривав дашборд</p>
      <button
        onClick={() => handleGenerateAi(selected)}
        disabled={generatingAi}
        className="text-xs text-kameya-burgundy font-semibold hover:opacity-75 flex items-center gap-1 disabled:opacity-40"
      >
        {generatingAi ? (
          <><i className="fas fa-spinner fa-spin"></i> Генеруємо...</>
        ) : (
          <><i className="fas fa-wand-magic-sparkles"></i> Згенерувати</>
        )}
      </button>
    </div>
  )}
  {aiError && <p className="text-xs text-red-500 mt-2">{aiError}</p>}
</div>
```

- [ ] **Step 6: Add AI status badge in the list rows**

In the list view, inside the `groupReports.map(...)` block, find the `<div className="flex items-center gap-2 flex-shrink-0">` that shows reflection status. Add an AI badge before the reflection status:

```tsx
{report.aiRecommendations && !report.scoreInsight && (
  <span className="text-xs text-amber-500 flex items-center gap-1">
    <i className="fas fa-wand-magic-sparkles"></i> Без відповіді
  </span>
)}
{report.aiRecommendations && report.scoreInsight && (
  <span className="text-xs text-green-600 flex items-center gap-1">
    <i className="fas fa-circle-check"></i> Відповів
  </span>
)}
```

- [ ] **Step 7: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Test admin flow**

With the dev server running, log in as admin. Open a report that has no `aiRecommendations`. Expected:
- Detail view shows "Консультант ще не відкривав дашборд" + "Згенерувати" button
- Clicking "Згенерувати" shows spinner then populates the panel
- List row now shows "Без відповіді" badge

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/admin/AdminReportsListView.tsx
git commit -m "feat: add AI recommendations panel and trigger in admin report detail view"
```

---

## Task 9: Final end-to-end verification

- [ ] **Step 1: Start backend**

```bash
cd backend && npm run dev
```

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Test employee flow for each tier**

Using test reports with different scores, verify:

| Score | Expected card behaviour |
|-------|------------------------|
| < 85% | Spinner → 3 weak points + goal textarea → submit → read-only view with goal |
| 85–94% | Spinner → 1 growth point + confirm button → submit → "Ти підтвердив" |
| 95–99% | Spinner → congratulation + question textarea → submit → read-only view |
| 100% | Instant celebration card (no spinner) → "Відзначити" button → "Зафіксовано" |

- [ ] **Step 4: Test no double-generation**

Refresh the dashboard after completing step 3. Expected: no spinner, recommendations appear immediately.

- [ ] **Step 5: Test admin panel**

Log in as admin. Open each report used above. Verify:
- AI recommendations are shown in the detail panel
- Consultant responses appear below the recommendations
- For a report where employee hasn't opened dashboard yet: "Згенерувати" button is visible and works

- [ ] **Step 6: Final commit if any fixes were made**

```bash
git add -p
git commit -m "fix: end-to-end score-insight adjustments"
```
