# Admin Learning Plan Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Надати адміну можливість видаляти, редагувати текст задач і перестворювати план навчання прямо зі сторінки деталей звіту.

**Architecture:** Два нові backend-маршрути (`DELETE` і `PATCH` для `/api/reports/:id/learning-plan`) + зняття ідемпотентності для адміна у вже існуючому `generate-learning-plan`. На фронтенді: дві нові service-функції та розширення `AdminReportsListView` — кнопки дій у заголовку панелі плану та модалка редагування задач.

**Tech Stack:** TypeScript, Express, Mongoose (backend); React 18, Tailwind CSS (frontend); Font Awesome icons.

## Global Constraints

- Всі нові backend-маршрути потребують `role === 'ADMIN'` — повертати 403 для інших ролей.
- Текст UI — виключно українською.
- Стилі — Tailwind, дотримуватись існуючого дизайну (кольори `kameya-burgundy`, `slate-*`, `rounded-xl`, тощо).
- Не чіпати логіку `toggle-learning-task` (відмічання задач користувачем).
- Не додавати нових задач — лише редагувати існуючі.

---

## Files

| File | Дія |
|------|-----|
| `backend/src/routes/reports.ts` | Modify: додати DELETE і PATCH маршрути; змінити generate-learning-plan для admin bypass |
| `frontend/src/services/reportsService.ts` | Modify: додати `deleteLearningPlan`, `updateLearningPlanTasks` |
| `frontend/src/components/admin/AdminReportsListView.tsx` | Modify: новий стан, кнопки дій, модалка редагування |

---

## Task 1: Backend — нові маршрути + admin bypass

**Files:**
- Modify: `backend/src/routes/reports.ts` (рядки 567–711)

**Interfaces:**
- Produces:
  - `DELETE /api/reports/:id/learning-plan` → `AuditResult` (без `learningPlan`)
  - `PATCH /api/reports/:id/learning-plan` body `{ tasks: LearningTask[] }` → `AuditResult`
  - `POST /api/reports/:id/generate-learning-plan` тепер для ADMIN перезаписує наявний план

---

- [ ] **Step 1: Додати `DELETE /api/reports/:id/learning-plan`**

Вставити **після рядка 711** (`});` що закриває `generate-learning-plan`), **перед** `// PATCH /api/reports/:id/learning-plan/:taskIndex`:

```typescript
// DELETE /api/reports/:id/learning-plan — admin only
router.delete('/:id/learning-plan', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $unset: { learningPlan: '' } },
      { new: true }
    );
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });
    return res.json(report);
  } catch (error) {
    console.error('delete-learning-plan error:', error);
    return res.status(500).json({ message: 'Помилка видалення плану' });
  }
});
```

- [ ] **Step 2: Додати `PATCH /api/reports/:id/learning-plan`**

Вставити одразу після щойно доданого DELETE маршруту:

```typescript
// PATCH /api/reports/:id/learning-plan — admin only, replaces tasks array
router.patch('/:id/learning-plan', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }
    const { tasks } = req.body as { tasks: { topicTitle: string; description: string; isCompleted: boolean; completedAt?: string; response?: string }[] };
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ message: 'Масив задач не може бути порожнім' });
    }
    const invalid = tasks.some(t => typeof t.topicTitle !== 'string' || typeof t.description !== 'string');
    if (invalid) {
      return res.status(400).json({ message: 'Кожна задача повинна мати topicTitle і description' });
    }
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });
    if (!report.learningPlan) return res.status(400).json({ message: 'План навчання не існує' });

    report.learningPlan.tasks = tasks as any;
    report.markModified('learningPlan');
    await report.save();
    return res.json(report);
  } catch (error) {
    console.error('update-learning-plan error:', error);
    return res.status(500).json({ message: 'Помилка оновлення плану' });
  }
});
```

- [ ] **Step 3: Зняти ідемпотентність для адміна в `generate-learning-plan`**

Знайти рядок (~587):
```typescript
    // Idempotent — return existing plan if already generated
    if (report.learningPlan) {
      return res.json(report);
    }
```
Замінити на:
```typescript
    // Idempotent for non-admins — return existing plan if already generated
    if (report.learningPlan && !isAdmin) {
      return res.json(report);
    }
```

Знайти рядок (~700):
```typescript
    const saved = await Report.findOneAndUpdate(
      { _id: report._id, learningPlan: { $exists: false } },
      { $set: { learningPlan: learningPlanData } },
      { new: true }
    );
```
Замінити на:
```typescript
    const saved = isAdmin
      ? await Report.findByIdAndUpdate(report._id, { $set: { learningPlan: learningPlanData } }, { new: true })
      : await Report.findOneAndUpdate(
          { _id: report._id, learningPlan: { $exists: false } },
          { $set: { learningPlan: learningPlanData } },
          { new: true }
        );
```

- [ ] **Step 4: Зібрати бекенд**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/backend
npm run build 2>&1 | tail -20
```
Очікувано: `Found 0 errors.` (або лише warnings — не errors).

- [ ] **Step 5: Ручне тестування DELETE маршруту**

Запустити бекенд (`npm run dev`). Отримати токен адміна і `reportId` зі звіту, що має `learningPlan`. Виконати:
```bash
curl -X DELETE http://localhost:3001/api/reports/<reportId>/learning-plan \
  -H "Authorization: Bearer <admin-token>"
```
Очікувано: JSON звіту без поля `learningPlan`.

- [ ] **Step 6: Ручне тестування PATCH маршруту**

```bash
curl -X PATCH http://localhost:3001/api/reports/<reportId>/learning-plan \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"tasks":[{"topicTitle":"Тема 1","description":"Нова задача","isCompleted":false}]}'
```
Очікувано: JSON звіту з оновленим `learningPlan.tasks`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: add admin DELETE/PATCH learning-plan routes and bypass idempotency"
```

---

## Task 2: Frontend — service functions

**Files:**
- Modify: `frontend/src/services/reportsService.ts`

**Interfaces:**
- Consumes: `DELETE /api/reports/:id/learning-plan`, `PATCH /api/reports/:id/learning-plan`
- Produces:
  - `deleteLearningPlan(reportId: string): Promise<AuditResult>`
  - `updateLearningPlanTasks(reportId: string, tasks: LearningTask[]): Promise<AuditResult>`

---

- [ ] **Step 1: Додати `LearningTask` до імпорту типів**

Знайти рядок 1:
```typescript
import { AuditResult, PointsTransaction, ScoreInsight } from '../types';
```
Замінити на:
```typescript
import { AuditResult, LearningTask, PointsTransaction, ScoreInsight } from '../types';
```

- [ ] **Step 2: Додати `deleteLearningPlan` після `generateLearningPlan`**

Після функції `generateLearningPlan` (після рядка ~184) додати:

```typescript
export const deleteLearningPlan = async (reportId: string): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/learning-plan`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка видалення плану навчання');
  }
  return res.json();
};
```

- [ ] **Step 3: Додати `updateLearningPlanTasks` після `deleteLearningPlan`**

```typescript
export const updateLearningPlanTasks = async (reportId: string, tasks: LearningTask[]): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/learning-plan`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка оновлення плану навчання');
  }
  return res.json();
};
```

- [ ] **Step 4: Перевірити TypeScript**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit 2>&1 | head -30
```
Очікувано: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/reportsService.ts
git commit -m "feat: add deleteLearningPlan and updateLearningPlanTasks service functions"
```

---

## Task 3: Frontend — AdminReportsListView — кнопки дій і модалка

**Files:**
- Modify: `frontend/src/components/admin/AdminReportsListView.tsx`

**Interfaces:**
- Consumes (з Task 2):
  - `deleteLearningPlan(reportId: string): Promise<AuditResult>`
  - `updateLearningPlanTasks(reportId: string, tasks: LearningTask[]): Promise<AuditResult>`
  - `generateLearningPlan(reportId: string): Promise<AuditResult>` (вже є)
- Consumes (з types):
  - `LearningTask` (тип з `frontend/src/types.ts`)

---

- [ ] **Step 1: Розширити імпорти**

Знайти рядок 1:
```typescript
import { AuditResult, AuditSection, STORES } from '../../types';
```
Замінити на:
```typescript
import { AuditResult, AuditSection, LearningTask, STORES } from '../../types';
```

Знайти рядок 3:
```typescript
import { getAllReports, deleteReport, generateAiRecommendations, updateReportPeriod } from '../../services/reportsService';
```
Замінити на:
```typescript
import { getAllReports, deleteReport, generateAiRecommendations, updateReportPeriod, deleteLearningPlan, updateLearningPlanTasks, generateLearningPlan } from '../../services/reportsService';
```

- [ ] **Step 2: Додати новий стан у компоненті `AdminReportsListView`**

Після рядка що оголошує `[periodError, setPeriodError]`:
```typescript
const [editingPlan, setEditingPlan] = useState(false);
const [editTasks, setEditTasks] = useState<LearningTask[]>([]);
const [planActionLoading, setPlanActionLoading] = useState(false);
const [planError, setPlanError] = useState<string | null>(null);
```

- [ ] **Step 3: Додати три handler-функції перед `return` компонента**

Після функції `openPointsHistory` (або перед return у detail view), додати:

```typescript
const applyPlanUpdate = (updated: AuditResult) => {
  const merged = { ...selected!, ...updated } as ReportWithUser;
  setSelected(merged);
  setReports(prev => prev.map(r => (r._id ?? r.id) === (merged._id ?? merged.id) ? merged : r));
};

const handleDeletePlan = async () => {
  if (!selected) return;
  if (!confirm('Видалити план навчання? Цю дію не можна скасувати.')) return;
  setPlanError(null);
  setPlanActionLoading(true);
  try {
    const updated = await deleteLearningPlan(selected._id ?? selected.id ?? '');
    applyPlanUpdate(updated);
  } catch (err) {
    setPlanError(err instanceof Error ? err.message : 'Помилка видалення');
  } finally {
    setPlanActionLoading(false);
  }
};

const handleRecreatePlan = async () => {
  if (!selected) return;
  if (!confirm('Перестворити план навчання? Поточний план і прогрес будуть втрачені.')) return;
  setPlanError(null);
  setPlanActionLoading(true);
  try {
    const updated = await generateLearningPlan(selected._id ?? selected.id ?? '');
    applyPlanUpdate(updated);
  } catch (err) {
    setPlanError(err instanceof Error ? err.message : 'Помилка генерації');
  } finally {
    setPlanActionLoading(false);
  }
};

const handleGeneratePlan = async () => {
  if (!selected) return;
  setPlanError(null);
  setPlanActionLoading(true);
  try {
    const updated = await generateLearningPlan(selected._id ?? selected.id ?? '');
    applyPlanUpdate(updated);
  } catch (err) {
    setPlanError(err instanceof Error ? err.message : 'Помилка генерації');
  } finally {
    setPlanActionLoading(false);
  }
};

const handleSavePlanEdit = async () => {
  if (!selected) return;
  setPlanError(null);
  setPlanActionLoading(true);
  try {
    const updated = await updateLearningPlanTasks(selected._id ?? selected.id ?? '', editTasks);
    applyPlanUpdate(updated);
    setEditingPlan(false);
  } catch (err) {
    setPlanError(err instanceof Error ? err.message : 'Помилка збереження');
  } finally {
    setPlanActionLoading(false);
  }
};
```

- [ ] **Step 4: Замінити панель "План навчання" у detail view**

Знайти блок (рядки ~458–513):
```tsx
        {/* Learning Plan panel */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700 mb-3">План навчання</p>
          {selected.learningPlan ? (
```
Замінити весь блок `{/* Learning Plan panel */}` (до закриваючого `</div>` цього div включно) на:

```tsx
        {/* Learning Plan panel */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">План навчання</p>
            {selected.learningPlan && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditTasks([...selected.learningPlan!.tasks]); setEditingPlan(true); }}
                  className="text-slate-400 hover:text-kameya-burgundy transition-colors"
                  title="Редагувати задачі"
                >
                  <i className="fas fa-pen text-xs"></i>
                </button>
                <button
                  onClick={handleRecreatePlan}
                  disabled={planActionLoading}
                  className="text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-40"
                  title="Перестворити план"
                >
                  <i className="fas fa-rotate text-xs"></i>
                </button>
                <button
                  onClick={handleDeletePlan}
                  disabled={planActionLoading}
                  className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="Видалити план"
                >
                  <i className="fas fa-trash-can text-xs"></i>
                </button>
              </div>
            )}
          </div>

          {selected.learningPlan ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Згенеровано: {new Date(selected.learningPlan.generatedAt).toLocaleDateString('uk-UA')}
                {' · '}
                {selected.learningPlan.tasks.filter(t => t.isCompleted).length}/{selected.learningPlan.tasks.length} виконано
              </p>
              {(() => {
                type LPTask = NonNullable<typeof selected.learningPlan>['tasks'][number];
                const groups: { topic: string; tasks: LPTask[] }[] = [];
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">План ще не згенеровано</p>
              {selected.aiRecommendations &&
                (selected.aiRecommendations.tier === 'below85' || selected.aiRecommendations.tier === 'range85to94') && (
                <button
                  onClick={handleGeneratePlan}
                  disabled={planActionLoading}
                  className="text-xs text-kameya-burgundy font-semibold hover:opacity-75 flex items-center gap-1 disabled:opacity-40"
                >
                  {planActionLoading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Генерація...</>
                  ) : (
                    <><i className="fas fa-wand-magic-sparkles"></i> Згенерувати</>
                  )}
                </button>
              )}
            </div>
          )}

          {planError && <p className="text-xs text-red-500 mt-2">{planError}</p>}
        </div>
```

- [ ] **Step 5: Додати модалку редагування задач**

Перед закриваючим `</div>` detail view (після рядка з закриттям `{reflectionReport?.reflection && ...}`), додати:

```tsx
        {/* Edit Learning Plan modal */}
        {editingPlan && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Редагувати задачі</h3>
                  <p className="text-sm text-slate-500">{getUserName(selected)} · {editTasks.length} задач</p>
                </div>
                <button onClick={() => setEditingPlan(false)} className="text-slate-400 hover:text-slate-600">
                  <i className="fas fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {editTasks.map((task, i) => (
                  <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Тема</label>
                      <input
                        type="text"
                        value={task.topicTitle}
                        onChange={e => setEditTasks(prev => prev.map((t, j) => j === i ? { ...t, topicTitle: e.target.value } : t))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Завдання</label>
                      <textarea
                        value={task.description}
                        onChange={e => setEditTasks(prev => prev.map((t, j) => j === i ? { ...t, description: e.target.value } : t))}
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => setEditingPlan(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleSavePlanEdit}
                  disabled={planActionLoading}
                  className="flex-1 py-3 rounded-xl bg-kameya-burgundy text-white font-bold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {planActionLoading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Збереження...</>
                  ) : (
                    <><i className="fas fa-floppy-disk"></i> Зберегти</>
                  )}
                </button>
              </div>
              {planError && <p className="text-xs text-red-500 px-6 pb-4">{planError}</p>}
            </div>
          </div>
        )}
```

- [ ] **Step 6: Перевірити TypeScript**

```bash
cd /Users/Apple/IT/mysteryshopperKameya/frontend
npx tsc --noEmit 2>&1 | head -30
```
Очікувано: no errors.

- [ ] **Step 7: Ручне тестування в браузері**

Запустити фронтенд і бекенд. Зайти як адмін, відкрити звіт з планом навчання:

1. **Редагувати** — клікнути `fa-pen`, змінити текст задачі, зберегти → задача оновилась у панелі.
2. **Видалити** — клікнути `fa-trash-can`, підтвердити → панель показує "Plan ще не згенеровано" + кнопку "Згенерувати" (якщо є aiRecommendations потрібного тіру).
3. **Згенерувати** — клікнути "Згенерувати" → спінер → новий план з'явився.
4. **Перестворити** — коли план є, клікнути `fa-rotate`, підтвердити → спінер → новий план (задачі змінились).
5. Перевірити що для звіту без `aiRecommendations` кнопка "Згенерувати" не показується.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/AdminReportsListView.tsx
git commit -m "feat: admin can delete, edit tasks, and recreate learning plan"
```
