# Learning Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-generated learning plan (from service standards PDF) to the employee dashboard, 100% celebration widget, and admin visibility of plan completion.

**Architecture:** Static PDF at `backend/data/standards.pdf` is parsed once at runtime into section chunks. When an employee clicks "Ознайомитись і скласти план навчання", the scoreInsight is saved and a two-step Claude call selects relevant sections then generates tasks. Tasks are stored on the Report document and shown as checkboxes in the "Ваш план навчання" dashboard section.

**Tech Stack:** Express + Mongoose + Anthropic SDK (`claude-haiku-4-5-20251001`), `pdf-parse` (new dep), React 18 + TypeScript + Tailwind CSS, CSS `@keyframes` animations.

---

## File Map

**New files:**
- `backend/src/services/standardsService.ts` — PDF parsing, chunking, cache
- `backend/data/.gitkeep` — keeps the data dir in git (PDF is not committed)
- `frontend/src/components/employee/PerfectScoreWidget.tsx` — 100% celebration widget
- `frontend/src/components/employee/LearningPlanSection.tsx` — dashboard plan section with checkboxes

**Modified files:**
- `backend/src/models/Report.ts` — add `ILearningTask`, `ILearningPlan`, schemas, field on `IReport`
- `backend/src/routes/reports.ts` — add `POST /:id/generate-learning-plan` and `PATCH /:id/learning-plan/:taskIndex`; import `getChunks`
- `frontend/src/types.ts` — add `LearningTask`, `LearningPlan` interfaces; add field to `AuditResult`
- `frontend/src/services/reportsService.ts` — add `generateLearningPlan`, `toggleLearningTask`
- `frontend/src/components/employee/ScoreInsightCard.tsx` — new prop `onLearningPlanLoading`, rename buttons, remove 100% block, fire learning plan generation on submit
- `frontend/src/components/Dashboard.tsx` — add `learningPlanLoading` state, render `PerfectScoreWidget` for 100%, pass prop to `ScoreInsightCard`, render `LearningPlanSection`
- `frontend/src/components/admin/AdminReportsListView.tsx` — add learning plan read-only panel in detail view
- `frontend/src/index.css` — add `@keyframes` for celebration widget

---

### Task 1: Data model — Report.ts + types.ts

**Files:**
- Modify: `backend/src/models/Report.ts`
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Add LearningTask and LearningPlan to `frontend/src/types.ts`**

Add after the `ScoreInsight` interface:

```ts
export interface LearningTask {
  topicTitle: string;
  description: string;
  isCompleted: boolean;
  completedAt?: string;
}

export interface LearningPlan {
  tasks: LearningTask[];
  generatedAt: string;
}
```

Add `learningPlan?: LearningPlan;` to the `AuditResult` interface (after the `scoreInsight?: ScoreInsight;` line).

- [ ] **Step 2: Add Mongoose interfaces and schemas to `backend/src/models/Report.ts`**

Add these interfaces before `export interface IReport`:

```ts
interface ILearningTask {
  topicTitle: string;
  description: string;
  isCompleted: boolean;
  completedAt?: Date;
}

interface ILearningPlan {
  tasks: ILearningTask[];
  generatedAt: Date;
}
```

Add `learningPlan?: ILearningPlan;` to the `IReport` interface (after `scoreInsight?`).

Add these schemas before `const ReportSchema`:

```ts
const LearningTaskSchema = new Schema<ILearningTask>({
  topicTitle:  { type: String, required: true },
  description: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
}, { _id: false });

const LearningPlanSchema = new Schema<ILearningPlan>({
  tasks:       [LearningTaskSchema],
  generatedAt: { type: Date, required: true },
}, { _id: false });
```

Add to `ReportSchema` fields (after `scoreInsight`):

```ts
learningPlan: { type: LearningPlanSchema, default: undefined },
```

- [ ] **Step 3: Type-check backend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/Report.ts frontend/src/types.ts
git commit -m "feat: add LearningPlan data model to Report and frontend types"
```

---

### Task 2: Standards PDF service

**Files:**
- Create: `backend/data/.gitkeep`
- Create: `backend/src/services/standardsService.ts`

- [ ] **Step 1: Install pdf-parse**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npm install pdf-parse
```

If TypeScript complains about missing types, add a declaration at the top of `standardsService.ts` (covered in step 2).

- [ ] **Step 2: Create `backend/data/.gitkeep`**

```bash
mkdir -p /Users/Apple/IT/mysteryshopperKameya/backend/data
touch /Users/Apple/IT/mysteryshopperKameya/backend/data/.gitkeep
```

Add a `.gitignore` rule to exclude the PDF but keep the directory:

In `backend/data/.gitignore` (create this file):
```
*.pdf
```

- [ ] **Step 3: Create `backend/src/services/standardsService.ts`**

```ts
import * as fs from 'fs';
import * as path from 'path';

// pdf-parse does not ship with @types — use require to avoid TS errors
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;

export interface StandardsChunk {
  index: number;
  title: string;
  content: string;
}

let cachedChunks: StandardsChunk[] | null = null;

export async function getChunks(): Promise<StandardsChunk[]> {
  if (cachedChunks !== null) return cachedChunks;

  const pdfPath = path.join(__dirname, '../../data/standards.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.warn('[standardsService] standards.pdf not found at', pdfPath, '— proceeding without context');
    cachedChunks = [];
    return cachedChunks;
  }

  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  cachedChunks = splitIntoChunks(data.text);
  console.log(`[standardsService] Loaded ${cachedChunks.length} chunks from standards.pdf`);
  return cachedChunks;
}

function splitIntoChunks(text: string): StandardsChunk[] {
  const lines = text.split('\n');
  // Match numbered headers like "1.", "2.1", "3.1.2" or ALL-CAPS Ukrainian/Latin lines ≥5 chars
  const numberedHeader = /^\d+(\.\d+)*[.\s]\s*\S/;
  const uppercaseHeader = /^[А-ЯІЇЄЁA-Z][А-ЯІЇЄЁA-Z\s\-–—]{4,}$/;

  const chunks: StandardsChunk[] = [];
  let currentTitle = 'Загальні положення';
  let currentLines: string[] = [];
  let index = 0;

  const flush = () => {
    const content = currentLines.join('\n').trim();
    if (content.length > 50) {
      chunks.push({ index: index++, title: currentTitle, content });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && (numberedHeader.test(trimmed) || uppercaseHeader.test(trimmed))) {
      flush();
      currentTitle = trimmed;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return chunks;
}
```

- [ ] **Step 4: Type-check backend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/standardsService.ts backend/data/.gitkeep backend/data/.gitignore backend/package.json backend/package-lock.json
git commit -m "feat: add standardsService — PDF chunking for learning plan generation"
```

---

### Task 3: generate-learning-plan endpoint

**Files:**
- Modify: `backend/src/routes/reports.ts`

- [ ] **Step 1: Add import for standardsService at top of `backend/src/routes/reports.ts`**

After the existing imports, add:

```ts
import { getChunks } from '../services/standardsService';
```

- [ ] **Step 2: Add `POST /:id/generate-learning-plan` endpoint**

Add this block after the `POST /:id/score-insight` endpoint (around line 485, before the reflection endpoint):

```ts
// POST /api/reports/:id/generate-learning-plan
router.post('/:id/generate-learning-plan', async (req: AuthRequest, res: Response) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    const isOwner = report.userId.toString() === req.user?.userId?.toString();
    const isAdmin = req.user?.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Доступ заборонено' });

    if (!report.aiRecommendations) {
      return res.status(400).json({ message: 'Спочатку згенеруйте AI рекомендації' });
    }

    const tier = report.aiRecommendations.tier;
    if (tier !== 'below85' && tier !== 'range85to94') {
      return res.status(400).json({ message: 'План навчання генерується лише для тірів below85 та range85to94' });
    }

    // Idempotent — return existing plan if already generated
    if (report.learningPlan) {
      return res.json(report);
    }

    const taskCount = tier === 'below85' ? 6 : 3;
    const weakPoints = report.aiRecommendations.weakPoints;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const chunks = await getChunks();

    let contextText = '';

    if (chunks.length > 0) {
      // Step 1 (cheap): identify relevant section indices
      const titlesText = chunks.map(c => `${c.index}: ${c.title}`).join('\n');
      const step1Prompt = `Ти аналітик навчання. Визнач найбільш релевантні розділи стандартів до слабких пунктів аудиту.
Поверни ТІЛЬКИ валідний JSON масив числових індексів (максимум 6) найбільш релевантних розділів.

Слабкі пункти:
${weakPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Розділи стандартів:
${titlesText}

Формат відповіді: [0, 3, 7]`;

      const step1Res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: step1Prompt }],
      });

      const step1Raw = (step1Res.content[0] as { type: string; text: string }).text.trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

      try {
        const parsed = JSON.parse(step1Raw);
        if (Array.isArray(parsed)) {
          const indices = parsed
            .filter((i): i is number => typeof i === 'number' && i >= 0 && i < chunks.length)
            .slice(0, 6);
          contextText = indices.map(i => `=== ${chunks[i].title} ===\n${chunks[i].content}`).join('\n\n');
        }
      } catch {
        // proceed without context if step 1 fails
        console.warn('[generate-learning-plan] step 1 index selection failed, proceeding without standards context');
      }
    }

    const contextSection = contextText ? `\nРелевантні розділи стандартів обслуговування:\n${contextText}\n` : '';

    const step2Prompt = `Ти тренер з продажів ювелірного магазину. Створи план навчання на основі слабких пунктів аудиту.
Поверни ТІЛЬКИ валідний JSON масив з рівно ${taskCount} задачами.
${contextSection}
Слабкі пункти:
${weakPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Формат кожної задачі:
{
  "topicTitle": "Назва теми або проблеми (до 60 символів)",
  "description": "Конкретне практичне завдання (1-2 речення, українська)"
}

Правила:
- ${tier === 'below85' ? 'Рівно 6 задач: по 2 задачі на кожен з 3 слабких пунктів. topicTitle кожної задачі — це назва слабкого пункту.' : 'Від 2 до 3 задач для одного слабкого пункту. topicTitle — назва слабкого пункту.'}
- description: конкретна дія (що переглянути, що відпрацювати, який розділ стандартів опрацювати)
- Якщо є розділи стандартів — обов\'язково вкажи конкретний розділ у description
- Без загальних порад, тільки конкретні дії`;

    let parsedTasks: { topicTitle: string; description: string }[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
      const step2Res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: step2Prompt }],
      });

      const step2Raw = (step2Res.content[0] as { type: string; text: string }).text.trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

      try {
        const parsed = JSON.parse(step2Raw);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0]?.topicTitle === 'string') {
          parsedTasks = parsed.filter(
            (t): t is { topicTitle: string; description: string } =>
              typeof t.topicTitle === 'string' && typeof t.description === 'string'
          );
          break;
        }
      } catch {
        if (attempt === 1) {
          console.error('[generate-learning-plan] step 2 failed both attempts. Raw:', step2Raw.substring(0, 300));
          return res.status(500).json({ message: 'AI повернув невалідну відповідь при генерації плану. Спробуйте ще раз.' });
        }
      }
    }

    if (parsedTasks.length === 0) {
      return res.status(500).json({ message: 'Не вдалось згенерувати план навчання' });
    }

    const learningPlanData = {
      tasks: parsedTasks.map(t => ({
        topicTitle: t.topicTitle.trim(),
        description: t.description.trim(),
        isCompleted: false,
      })),
      generatedAt: new Date(),
    };

    // Atomic save — race condition safe
    const saved = await Report.findOneAndUpdate(
      { _id: report._id, learningPlan: { $exists: false } },
      { $set: { learningPlan: learningPlanData } },
      { new: true }
    );

    return res.json(saved ?? await Report.findById(report._id));
  } catch (error) {
    console.error('generate-learning-plan error:', error);
    return res.status(500).json({ message: 'Помилка генерації плану навчання' });
  }
});
```

- [ ] **Step 3: Type-check backend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify endpoint smoke-test (no standards.pdf needed)**

Start the backend (`npm run dev` in `/backend`), then with a valid admin token and an existing report ID that has `aiRecommendations` (tier below85 or range85to94):

```bash
curl -X POST http://localhost:3001/api/reports/<REPORT_ID>/generate-learning-plan \
  -H "Authorization: Bearer <TOKEN>"
```

Expected: returns report JSON with `learningPlan` containing `tasks` array (6 or 3 items) and `generatedAt`.

If `standards.pdf` is not present, tasks are still generated (without standards context) — the warning `[standardsService] standards.pdf not found` appears in console.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: add POST /api/reports/:id/generate-learning-plan endpoint"
```

---

### Task 4: Toggle learning task endpoint

**Files:**
- Modify: `backend/src/routes/reports.ts`

- [ ] **Step 1: Add `PATCH /:id/learning-plan/:taskIndex` endpoint**

Add this block immediately after the `generate-learning-plan` endpoint (before the reflection endpoint):

```ts
// PATCH /api/reports/:id/learning-plan/:taskIndex — toggle task completion
router.patch('/:id/learning-plan/:taskIndex', async (req: AuthRequest, res: Response) => {
  try {
    const taskIndex = parseInt(req.params.taskIndex, 10);
    if (isNaN(taskIndex) || taskIndex < 0) {
      return res.status(400).json({ message: 'Невалідний індекс задачі' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    if (report.userId.toString() !== req.user?.userId?.toString()) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    if (!report.learningPlan || taskIndex >= report.learningPlan.tasks.length) {
      return res.status(400).json({ message: 'Задача не знайдена' });
    }

    const task = report.learningPlan.tasks[taskIndex];
    task.isCompleted = !task.isCompleted;
    task.completedAt = task.isCompleted ? new Date() : undefined;

    report.markModified('learningPlan');
    await report.save();

    return res.json(report);
  } catch (error) {
    console.error('toggle-learning-task error:', error);
    return res.status(500).json({ message: 'Помилка збереження' });
  }
});
```

- [ ] **Step 2: Type-check backend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: add PATCH /api/reports/:id/learning-plan/:taskIndex endpoint"
```

---

### Task 5: Frontend service functions

**Files:**
- Modify: `frontend/src/services/reportsService.ts`

- [ ] **Step 1: Add `generateLearningPlan` and `toggleLearningTask` to `reportsService.ts`**

Append to the end of `frontend/src/services/reportsService.ts`:

```ts
export const generateLearningPlan = async (reportId: string): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/generate-learning-plan`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка генерації плану навчання');
  }
  return res.json();
};

export const toggleLearningTask = async (reportId: string, taskIndex: number): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/learning-plan/${taskIndex}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка оновлення задачі');
  }
  return res.json();
};
```

- [ ] **Step 2: Type-check frontend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/reportsService.ts
git commit -m "feat: add generateLearningPlan and toggleLearningTask service functions"
```

---

### Task 6: PerfectScoreWidget + CSS animations

**Files:**
- Create: `frontend/src/components/employee/PerfectScoreWidget.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add CSS keyframes to `frontend/src/index.css`**

Append to the end of `frontend/src/index.css`:

```css
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.3); }
  50%       { box-shadow: 0 0 28px 10px rgba(245, 158, 11, 0.2); }
}

@keyframes trophyBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  40%      { transform: translateY(-10px) scale(1.12); }
  65%      { transform: translateY(-4px) scale(1.06); }
}

@keyframes floatStar {
  0%   { transform: translateY(0) rotate(0deg);   opacity: 0.5; }
  50%  { transform: translateY(-14px) rotate(20deg); opacity: 1;   }
  100% { transform: translateY(0) rotate(0deg);   opacity: 0.5; }
}

@keyframes scaleIn {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}

.perfect-score-widget {
  animation: pulseGlow 2.5s ease-in-out infinite, scaleIn 0.4s ease-out both;
}
.trophy-bounce { display: inline-block; animation: trophyBounce 2.2s ease-in-out infinite; }
.float-star    { animation: floatStar 3s ease-in-out infinite; }
```

- [ ] **Step 2: Create `frontend/src/components/employee/PerfectScoreWidget.tsx`**

```tsx
import React, { useState } from 'react';
import { AuditResult } from '../../types';
import { submitScoreInsight } from '../../services/reportsService';

interface Props {
  report: AuditResult;
  perfectCount: number;
  onInsightUpdated: (updated: AuditResult) => void;
}

const STAR_POSITIONS = [
  { left: '8%',  top: '18%', size: '1rem',   delay: '0s'   },
  { left: '20%', top: '72%', size: '0.75rem', delay: '0.5s' },
  { left: '35%', top: '12%', size: '1.2rem',  delay: '0.9s' },
  { left: '52%', top: '80%', size: '0.8rem',  delay: '0.3s' },
  { left: '65%', top: '15%', size: '1rem',    delay: '1.1s' },
  { left: '78%', top: '65%', size: '0.7rem',  delay: '0.7s' },
  { left: '88%', top: '28%', size: '1.1rem',  delay: '0.2s' },
  { left: '92%', top: '75%', size: '0.9rem',  delay: '1.4s' },
];

export const PerfectScoreWidget: React.FC<Props> = ({ report, perfectCount, onInsightUpdated }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportId = report._id ?? report.id ?? '';
  const insight = report.scoreInsight;

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

  return (
    <div className="perfect-score-widget bg-white rounded-2xl border border-yellow-200 overflow-hidden relative min-h-[220px]">
      {STAR_POSITIONS.map((s, i) => (
        <span
          key={i}
          className="float-star absolute text-yellow-400 select-none pointer-events-none"
          style={{ left: s.left, top: s.top, fontSize: s.size, animationDelay: s.delay }}
        >
          ✦
        </span>
      ))}

      <div className="relative z-10 p-6 flex flex-col items-center justify-center text-center space-y-3 h-full">
        <div className="trophy-bounce text-5xl">🏆</div>
        <p className="text-xl font-bold text-slate-800">Ідеальна перевірка!</p>
        <p className="text-sm font-semibold text-amber-600">
          {perfectCount > 1
            ? `Ви досягали 100% вже ${perfectCount} рази`
            : 'Перший результат 100% — неймовірно!'}
        </p>

        {!insight ? (
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="mt-1 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-md"
          >
            {submitting ? 'Зберігаємо...' : '🌟 Відзначити досягнення'}
          </button>
        ) : (
          <span className="text-sm text-green-600 flex items-center gap-1 font-semibold">
            <i className="fas fa-circle-check"></i> Досягнення зафіксовано
          </span>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Type-check frontend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/employee/PerfectScoreWidget.tsx frontend/src/index.css
git commit -m "feat: add PerfectScoreWidget with CSS celebration animations"
```

---

### Task 7: ScoreInsightCard — update buttons and learning plan trigger

**Files:**
- Modify: `frontend/src/components/employee/ScoreInsightCard.tsx`

- [ ] **Step 1: Replace the full contents of `ScoreInsightCard.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { AuditResult } from '../../types';
import {
  generateAiRecommendations,
  submitScoreInsight,
  generateLearningPlan,
} from '../../services/reportsService';

interface Props {
  lastAudit: AuditResult;
  allReports: AuditResult[];
  onInsightUpdated: (updated: AuditResult) => void;
  onLearningPlanLoading: (loading: boolean) => void;
}

export const ScoreInsightCard: React.FC<Props> = ({
  lastAudit,
  allReports: _allReports,
  onInsightUpdated,
  onLearningPlanLoading,
}) => {
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [whatHelpedText, setWhatHelpedText] = useState('');

  const reportId = lastAudit._id ?? lastAudit.id ?? '';
  const ai = lastAudit.aiRecommendations;
  const insight = lastAudit.scoreInsight;

  const onInsightUpdatedRef = React.useRef(onInsightUpdated);
  onInsightUpdatedRef.current = onInsightUpdated;

  const onLearningPlanLoadingRef = React.useRef(onLearningPlanLoading);
  onLearningPlanLoadingRef.current = onLearningPlanLoading;

  // Auto-trigger AI recommendations on first open (not for 100%)
  useEffect(() => {
    if (lastAudit.totalScore === 100) return;
    if (ai) return;
    if (!reportId) return;

    setGenerating(true);
    generateAiRecommendations(reportId)
      .then(updated => onInsightUpdatedRef.current(updated))
      .catch(err => setError(err instanceof Error ? err.message : 'Помилка'))
      .finally(() => setGenerating(false));
  // reportId and !!ai are stable; totalScore===100 is stable per report
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, lastAudit.totalScore === 100, !!ai]);

  // Fire learning plan generation after acknowledgment (non-blocking)
  const triggerLearningPlan = (id: string) => {
    onLearningPlanLoadingRef.current(true);
    generateLearningPlan(id)
      .then(updated => onInsightUpdatedRef.current(updated))
      .catch(err => console.error('[ScoreInsightCard] learning plan generation failed:', err))
      .finally(() => onLearningPlanLoadingRef.current(false));
  };

  const handleSubmitGoal = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitScoreInsight(reportId, { goalText });
      onInsightUpdated(updated);
      triggerLearningPlan(reportId);
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
      triggerLearningPlan(reportId);
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

  if (generating) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-3 min-h-[200px]">
        <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy"></i>
        <p className="text-sm font-medium text-slate-600">Обробляємо ваші рекомендації...</p>
        <p className="text-xs text-slate-400">Це займе кілька секунд</p>
      </div>
    );
  }

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

  // ── Submitted — read-only ──
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
            {submitting ? 'Зберігаємо...' : 'Ознайомитись і скласти план навчання'}
          </button>
        </div>
      )}

      {tier === 'range85to94' && (
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full py-2 bg-kameya-burgundy text-white rounded-xl font-bold text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Зберігаємо...' : 'Ознайомитись і скласти план навчання'}
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
            {submitting ? 'Зберігаємо...' : 'Ознайомитись'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
```

- [ ] **Step 2: Type-check frontend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/employee/ScoreInsightCard.tsx
git commit -m "feat: update ScoreInsightCard — rename buttons, trigger learning plan generation"
```

---

### Task 8: LearningPlanSection component

**Files:**
- Create: `frontend/src/components/employee/LearningPlanSection.tsx`

- [ ] **Step 1: Create `frontend/src/components/employee/LearningPlanSection.tsx`**

```tsx
import React, { useState } from 'react';
import { AuditResult, LearningTask } from '../../types';
import { toggleLearningTask } from '../../services/reportsService';

interface Props {
  lastAudit: AuditResult | undefined;
  loading: boolean;
  onPlanUpdated: (updated: AuditResult) => void;
  onNavigateToTraining: () => void;
}

export const LearningPlanSection: React.FC<Props> = ({
  lastAudit,
  loading,
  onPlanUpdated,
  onNavigateToTraining,
}) => {
  const [togglingIndex, setTogglingIndex] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const plan = lastAudit?.learningPlan;
  const reportId = lastAudit?._id ?? lastAudit?.id ?? '';

  const handleToggle = async (taskIndex: number) => {
    if (!lastAudit || togglingIndex !== null) return;
    setTogglingIndex(taskIndex);
    setToggleError(null);

    // Optimistic update
    const optimistic: AuditResult = {
      ...lastAudit,
      learningPlan: lastAudit.learningPlan
        ? {
            ...lastAudit.learningPlan,
            tasks: lastAudit.learningPlan.tasks.map((t, i) =>
              i === taskIndex ? { ...t, isCompleted: !t.isCompleted } : t
            ),
          }
        : undefined,
    };
    onPlanUpdated(optimistic);

    try {
      const updated = await toggleLearningTask(reportId, taskIndex);
      onPlanUpdated(updated);
    } catch {
      onPlanUpdated(lastAudit); // revert
      setToggleError('Не вдалося оновити задачу');
    } finally {
      setTogglingIndex(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[160px]">
        <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy mb-3"></i>
        <p className="text-slate-500 font-medium text-sm">Складаємо ваш план навчання...</p>
        <p className="text-xs text-slate-400 mt-1">Це займе кілька секунд</p>
      </div>
    );
  }

  if (plan && plan.tasks.length > 0) {
    const completed = plan.tasks.filter(t => t.isCompleted).length;
    const total = plan.tasks.length;

    // Group by topicTitle preserving insertion order
    const groups: { topic: string; items: { task: LearningTask; index: number }[] }[] = [];
    const seen = new Map<string, number>();
    plan.tasks.forEach((task, index) => {
      const existing = seen.get(task.topicTitle);
      if (existing !== undefined) {
        groups[existing].items.push({ task, index });
      } else {
        seen.set(task.topicTitle, groups.length);
        groups.push({ topic: task.topicTitle, items: [{ task, index }] });
      }
    });

    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg text-slate-800">Ваш план навчання</h3>
          {completed === total && (
            <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
              <i className="fas fa-circle-check"></i> Завершено
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">{completed}/{total} виконано</p>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-6">
          <div
            className="h-1.5 rounded-full bg-kameya-burgundy transition-all duration-500"
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
          />
        </div>

        <div className="space-y-5">
          {groups.map(({ topic, items }) => (
            <div key={topic}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{topic}</p>
              <div className="space-y-2">
                {items.map(({ task, index }) => (
                  <label
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none ${
                      task.isCompleted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    } ${togglingIndex === index ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={task.isCompleted}
                      onChange={() => handleToggle(index)}
                      disabled={togglingIndex === index}
                      className="mt-0.5 flex-shrink-0 accent-kameya-burgundy w-4 h-4"
                    />
                    <span
                      className={`text-sm leading-relaxed ${
                        task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'
                      }`}
                    >
                      {task.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {toggleError && <p className="text-xs text-red-500 mt-3">{toggleError}</p>}
      </div>
    );
  }

  // Default placeholder (no plan yet — 100%, 95-99%, or pre-acknowledgment)
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
      <h3 className="font-bold text-lg text-slate-800 mb-6">Ваш план навчання</h3>
      <div className="flex flex-col items-center justify-center py-12 flex-1">
        <i className="fas fa-book text-5xl text-slate-200 mb-4"></i>
        <p className="text-slate-500 font-medium">План навчання не обрано</p>
        <p className="text-xs text-slate-400 mt-2 text-center">Обберіть план навчання, щоб почати</p>
        <button
          onClick={onNavigateToTraining}
          className="mt-6 px-6 py-3 bg-kameya-burgundy text-white rounded-xl font-bold hover:bg-red-900 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
        >
          Обрати план навчання
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check frontend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/employee/LearningPlanSection.tsx
git commit -m "feat: add LearningPlanSection component with checkboxes and progress bar"
```

---

### Task 9: Dashboard wiring

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`

- [ ] **Step 1: Replace the full contents of `frontend/src/components/Dashboard.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { Screen, AuditResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { getMyReports } from '../services/reportsService';
import { getTodayTip, TipOfDay } from '../services/tipsService';
import { formatDate } from '../utils/dateFormatter';
import { ScoreChart } from './employee/ScoreChart';
import { ScoreInsightCard } from './employee/ScoreInsightCard';
import { PerfectScoreWidget } from './employee/PerfectScoreWidget';
import { LearningPlanSection } from './employee/LearningPlanSection';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
  onNavigateToAuditDetails?: (audit: AuditResult) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onNavigateToAuditDetails }) => {
  const { user } = useAuth();
  const fullName = user?.name ?? 'Вітаємо';
  const [lastAudit, setLastAudit] = useState<AuditResult | undefined>();
  const [allReports, setAllReports] = useState<AuditResult[]>([]);
  const [tip, setTip] = useState<TipOfDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [learningPlanLoading, setLearningPlanLoading] = useState(false);

  useEffect(() => {
    Promise.all([getMyReports(), getTodayTip()])
      .then(([reports, tipData]) => {
        if (reports.length > 0) setLastAudit(reports[0]);
        setAllReports(reports);
        setTip(tipData);
      })
      .catch(() => console.error('Помилка завантаження даних'))
      .finally(() => setLoading(false));
  }, []);

  const handleInsightUpdated = (updated: AuditResult) => {
    setLastAudit(updated);
    setAllReports(prev =>
      prev.map(r => (r._id ?? r.id) === (updated._id ?? updated.id) ? updated : r)
    );
  };

  const radius = 54;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = lastAudit
    ? circumference - (lastAudit.totalScore / 100) * circumference
    : circumference;

  const perfectCount = allReports.filter(r => r.totalScore === 100).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Вітаємо, {fullName}!</h2>
        <p className="text-slate-500 mt-1">Ось огляд ваших останніх результатів та завдань на сьогодні.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Score Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Остання оцінка</p>

          {lastAudit ? (
            <>
              <div className="relative inline-flex items-center justify-center">
                <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                  <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} className="text-slate-100" r={normalizedRadius} cx={radius} cy={radius} />
                  <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} strokeDasharray={`${circumference} ${circumference}`} style={{ strokeDashoffset }} strokeLinecap="round" className="text-kameya-burgundy transition-all duration-1000 ease-out" r={normalizedRadius} cx={radius} cy={radius} />
                </svg>
                <span className="absolute text-3xl font-bold text-slate-800 tracking-tight">{Math.round(lastAudit.totalScore)}%</span>
              </div>
              {lastAudit.quarter && lastAudit.year && (
                <p className="mt-6 text-sm font-semibold text-kameya-burgundy">{lastAudit.quarter} {lastAudit.year}</p>
              )}
              <p className={`${lastAudit.quarter && lastAudit.year ? '' : 'mt-6'} text-sm text-slate-500 font-medium`}>
                Дата перевірки: {formatDate(lastAudit.date)}
              </p>
              {lastAudit.store && (
                <p className="text-sm text-slate-500 font-medium">Магазин: {lastAudit.store}</p>
              )}
              <button
                onClick={() => lastAudit && onNavigateToAuditDetails?.(lastAudit)}
                className="mt-4 text-kameya-burgundy font-bold text-sm hover:text-red-900 transition-colors flex items-center space-x-1"
              >
                <span>Детальний звіт</span>
                <i className="fas fa-arrow-right text-xs"></i>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <i className="fas fa-clipboard text-5xl text-slate-200 mb-4"></i>
              <p className="text-slate-500 font-medium">Перевірок ще немає</p>
              <p className="text-xs text-slate-400 mt-2">Ваша перша перевірка з'явиться тут</p>
            </div>
          )}
        </div>

        {/* Plan rosту / Perfect widget */}
        {lastAudit ? (
          lastAudit.totalScore === 100 ? (
            <PerfectScoreWidget
              report={lastAudit}
              perfectCount={perfectCount}
              onInsightUpdated={handleInsightUpdated}
            />
          ) : (
            <ScoreInsightCard
              lastAudit={lastAudit}
              allReports={allReports}
              onInsightUpdated={handleInsightUpdated}
              onLearningPlanLoading={setLearningPlanLoading}
            />
          )
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center min-h-[160px]">
            <i className="fas fa-star text-slate-200 text-4xl mb-3"></i>
            <p className="text-slate-400 text-sm">Незабаром</p>
          </div>
        )}
      </div>

      {/* Learning Plan — full width */}
      <LearningPlanSection
        lastAudit={lastAudit}
        loading={learningPlanLoading}
        onPlanUpdated={handleInsightUpdated}
        onNavigateToTraining={() => onNavigate(Screen.TRAINING_PLAN)}
      />

      {/* Score Chart */}
      {allReports.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-1">Динаміка оцінок {new Date().getFullYear()}</h3>
          <p className="text-xs text-slate-400 mb-4">Результати таємного покупця по кварталах</p>
          <ScoreChart reports={allReports} />
        </div>
      )}

      {/* Daily Tip */}
      <div className="bg-kameya-burgundy p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <i className="fas fa-lightbulb"></i>
            Порада дня
          </h3>
          <p className="opacity-90 leading-relaxed text-sm md:text-base font-medium">
            {tip?.content || 'Завантажуємо пораду дня для вас...'}
          </p>
        </div>
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check frontend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual browser test — golden path**

Start both servers. Log in as an employee with a report scored below 85%.

1. Dashboard loads → "Твій план росту" card appears, auto-generates AI recommendations (spinner then weak points)
2. Fill in the goal textarea → click "Ознайомитись і скласти план навчання"
3. "Ваш план навчання" section shows spinner "Складаємо ваш план навчання..."
4. After ~10s, checkboxes appear grouped by topic
5. Check one box → it toggles with strikethrough
6. Reload page → checkbox state persists

For 100%: log in as employee with a 100% report → PerfectScoreWidget shows with pulsing glow, floating stars, bouncing trophy.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Dashboard.tsx
git commit -m "feat: wire Dashboard — PerfectScoreWidget for 100%, LearningPlanSection with loading state"
```

---

### Task 10: Admin learning plan panel

**Files:**
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

- [ ] **Step 1: Add learning plan panel to the detail view in `AdminReportsListView.tsx`**

In the detail view section (after the closing `</div>` of the "AI Рекомендації" panel, around line 431), add:

```tsx
{/* Learning Plan panel */}
<div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
  <p className="text-sm font-semibold text-slate-700 mb-3">План навчання</p>
  {selected.learningPlan ? (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Згенеровано: {new Date(selected.learningPlan.generatedAt).toLocaleDateString('uk-UA')}
        {' · '}
        {selected.learningPlan.tasks.filter(t => t.isCompleted).length}/{selected.learningPlan.tasks.length} виконано
      </p>
      {(() => {
        // Group by topicTitle preserving insertion order
        const groups: { topic: string; tasks: typeof selected.learningPlan.tasks }[] = [];
        const seen = new Map<string, number>();
        selected.learningPlan.tasks.forEach(t => {
          const idx = seen.get(t.topicTitle);
          if (idx !== undefined) {
            groups[idx].tasks.push(t);
          } else {
            seen.set(t.topicTitle, groups.length);
            groups.push({ topic: t.topicTitle, tasks: [t] });
          }
        });
        return groups.map(({ topic, tasks }) => (
          <div key={topic}>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{topic}</p>
            <div className="space-y-1">
              {tasks.map((task, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                    task.isCompleted ? 'bg-green-50' : 'bg-slate-50'
                  }`}
                >
                  <i className={`fas ${task.isCompleted ? 'fa-circle-check text-green-500' : 'fa-circle text-slate-300'} flex-shrink-0 mt-0.5 text-xs`}></i>
                  <div className="flex-1">
                    <span className={task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}>
                      {task.description}
                    </span>
                    {task.completedAt && (
                      <span className="ml-2 text-xs text-green-600">
                        {new Date(task.completedAt).toLocaleDateString('uk-UA')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ));
      })()}
    </div>
  ) : (
    <p className="text-sm text-slate-400">План ще не згенеровано</p>
  )}
</div>
```

- [ ] **Step 2: Type-check frontend**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual browser test — admin view**

Log in as admin. Open a report that has a learning plan (one that an employee has already acknowledged).

Expected:
- "План навчання" panel appears below "AI Рекомендації"
- Shows date generated and X/Y completion count
- Tasks grouped by topic, completed ones have green checkmark + strikethrough + completion date
- Uncompleted ones show grey circle

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/AdminReportsListView.tsx
git commit -m "feat: add learning plan read-only panel to admin report detail view"
```

---

## Post-implementation checklist

- [ ] Drop `standards.pdf` into `backend/data/` and restart the backend server
- [ ] Open a report with below85 score, acknowledge → verify plan generates with references to standards sections
- [ ] Verify 6 tasks for below85, 2-3 tasks for range85to94
- [ ] Mark all tasks complete → progress bar fills to 100%, admin sees completion
- [ ] Test 100% report → PerfectScoreWidget animates, "Відзначити досягнення" saves and shows "Зафіксовано"
- [ ] Test 95-99% report → button says "Ознайомитись", disabled until textarea filled
