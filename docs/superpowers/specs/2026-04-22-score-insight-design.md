# Score Insight + AI Recommendations — Design Spec

**Date:** 2026-04-22
**Feature:** Smart dashboard card replacing the "Незабаром" placeholder

---

## Overview

The right card on the employee dashboard currently shows a static placeholder. This feature replaces it with a score-aware block that:

1. Calls Claude API once (on first dashboard open) to generate personalized recommendations based on the last audit
2. Saves those recommendations to the report in the DB — never regenerates
3. Prompts the consultant to respond (set a goal, confirm understanding, or share what helped)
4. Shows both AI recommendations and consultant response in the admin panel

---

## Score Tiers

| Score | Tier key | AI generates | Consultant does |
|-------|----------|-------------|-----------------|
| < 85% | `below85` | 3 weak points + `mainMessage` | Textarea "Яка твоя ціль до наступної перевірки?" → saves `goalText` |
| 85–94% | `range85to94` | 1 growth point + `mainMessage` | Button "Розумію, буду працювати над цим" → saves `confirmedAt` |
| 95–99% | `range95to99` | Congratulations + a question prompt | Textarea "Що допомогло тобі досягти такого результату?" → saves `whatHelpedText` |
| 100% | `perfect100` | *(not generated — static celebration)* | Button "Відзначити" → saves `tier: perfect100` |

The 100% card shows: trophy icon, "Ідеальна перевірка!", and "Це твій N-й результат 100%" where N is calculated from `allReports.filter(r => r.totalScore === 100).length`.

---

## Data Model

Two new subdocuments added to `Report`:

### `aiRecommendations` — written by backend (Claude)

```ts
interface IAiRecommendations {
  tier: 'below85' | 'range85to94' | 'range95to99' | 'perfect100';
  weakPoints: string[];    // 1–3 specific phrases in Ukrainian
  mainMessage: string;     // lead sentence shown above the list
  question?: string;       // question string for 95–99% tier (null otherwise)
  generatedAt: Date;
}
```

### `scoreInsight` — written by employee

```ts
interface IScoreInsight {
  tier: 'below85' | 'range85to94' | 'range95to99' | 'perfect100';
  goalText?: string;       // <85%: consultant's stated goal
  confirmedAt?: Date;      // 85–94%: timestamp of button press
  whatHelpedText?: string; // 95–99%: consultant's answer
  submittedAt: Date;
}
```

These are stored as embedded subdocuments on the `Report` mongoose document, matching the existing `reflection` pattern.

---

## API Endpoints

### `POST /api/reports/:id/generate-ai`

- Auth: employee (own report) or ADMIN
- If `aiRecommendations` already exists on the report → return it immediately, do not call Claude
- If missing → call Claude API with report data, save result, return it
- Claude receives: `totalScore`, all `sections` (title, score, maxScore, questions with isCorrect/score/question text)
- Claude returns JSON matching `IAiRecommendations`
- For `perfect100` tier: endpoint returns 400 — frontend never calls this endpoint for 100% scores

**Claude prompt goal:** Identify the weakest areas from the audit data and return specific, actionable Ukrainian-language recommendations. For 95–99%, return an encouraging message and the reflection question. Response must be valid JSON only.

### `POST /api/reports/:id/score-insight`

- Auth: employee (own report only)
- If `scoreInsight` already exists → return 409 (already submitted)
- Validates required fields per tier:
  - `below85`: requires `goalText`
  - `range85to94`: requires no body (sets `confirmedAt: now`)
  - `range95to99`: requires `whatHelpedText`
  - `perfect100`: no body required
- Saves `scoreInsight` to report

### `GET /api/reports/insights` *(admin only)*

> Must be registered **before** `GET /api/reports/:id` in Express, otherwise "insights" is matched as an `:id`.

- Returns all reports with `aiRecommendations` populated
- Includes `user.name`, `user.store`, `totalScore`, `aiRecommendations`, `scoreInsight`
- Used by admin panel to display recommendations alongside consultant responses

---

## Frontend

### `ScoreInsightCard.tsx`

New component replacing the placeholder in `Dashboard.tsx`. Props:

```ts
interface Props {
  lastAudit: AuditResult;
  allReports: AuditResult[];
  onInsightSubmitted: (updated: AuditResult) => void;
}
```

**Component states:**

1. **`generating`** — `aiRecommendations` is absent, API call in progress
   - Shows spinner + "Обробляємо ваші рекомендації..."

2. **`ready_for_input`** — `aiRecommendations` present, `scoreInsight` absent
   - Shows `mainMessage` and `weakPoints` list
   - Shows tier-appropriate input (textarea or button)

3. **`submitted`** — both `aiRecommendations` and `scoreInsight` present
   - Shows recommendations (read-only)
   - Shows consultant's response (read-only)

4. **`perfect100`** — `totalScore === 100`
   - Detected by `totalScore === 100` check alone — no API call to `generate-ai`
   - Static celebration card: trophy icon, count of 100% results from `allReports`
   - Button "Відзначити" if `scoreInsight` not yet saved

### Types update — `types.ts`

Add to `AuditResult`:
```ts
aiRecommendations?: AiRecommendations;
scoreInsight?: ScoreInsight;
```

Add new interfaces:
```ts
interface AiRecommendations {
  tier: 'below85' | 'range85to94' | 'range95to99' | 'perfect100';
  weakPoints: string[];
  mainMessage: string;
  question?: string;
  generatedAt: string;
}

interface ScoreInsight {
  tier: 'below85' | 'range85to94' | 'range95to99' | 'perfect100';
  goalText?: string;
  confirmedAt?: string;
  whatHelpedText?: string;
  submittedAt: string;
}
```

### `reportsService.ts` additions

```ts
generateAiRecommendations(reportId: string): Promise<AuditResult>
submitScoreInsight(reportId: string, data: Partial<ScoreInsight>): Promise<AuditResult>
```

---

## Admin Panel — `AdminReportsListView.tsx`

Each report row becomes expandable. Clicking a row (or an expand chevron) reveals an inline block showing:

- **AI Recommendations section:**
  - If `aiRecommendations` exists: show `mainMessage` and `weakPoints` list
  - If absent and `totalScore < 100`: show button "Згенерувати рекомендації" → calls `POST /api/reports/:id/generate-ai` from admin
  - If absent and `totalScore === 100`: show "100% — без AI рекомендацій"
- **Consultant Response section:**
  - If `scoreInsight` exists: show the goal/confirmation/answer
  - If absent: show "Консультант ще не відповів"

The existing table columns (name, store, score, date) remain unchanged.

---

## Claude Prompt Design

Input to Claude (JSON body sent as text):

```
Ти — аналітик результатів таємного покупця ювелірного магазину.
Проаналізуй наступний звіт і поверни ТІЛЬКИ валідний JSON без markdown.

Загальна оцінка: {totalScore}%
Секції:
{sections mapped as: "Назва: score/maxScore\n  Питання без балів: [list of question texts where isCorrect=false]"}

Поверни JSON у форматі:
{
  "tier": "below85" | "range85to94" | "range95to99",
  "mainMessage": "...",
  "weakPoints": ["...", "..."],
  "question": "..." або null
}

Правила:
- weakPoints: для below85 — 3 конкретні пункти; для range85to94 — 1 пункт; для range95to99 — порожній масив
- mainMessage: одне речення українською, що відповідає тіру
- question: для range95to99 — "Що допомогло тобі досягти такого результату?"; для решти — null
- Всі тексти українською мовою, конкретні, без загальних фраз
```

---

## Out of Scope

- Push notifications when recommendations are ready
- Email summary to manager
- Editing a submitted `scoreInsight`
- Generating recommendations for reports older than the latest one from the dashboard
