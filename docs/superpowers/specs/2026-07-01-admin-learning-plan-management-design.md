# Admin Learning Plan Management — Design Spec

**Date:** 2026-07-01  
**Status:** Approved

## Overview

Адмін повинен мати можливість видаляти, редагувати текст задач та перестворювати план навчання для будь-якого звіту користувача.

## Scope

- Редагування = зміна `topicTitle` та `description` окремих задач вручну (не статус виконання).
- Дії доступні лише в адмін-панелі (`AdminReportsListView`), лише для ролі `ADMIN`.
- Не стосується перегляду плану самим користувачем.

---

## Backend

### 1. DELETE /api/reports/:id/learning-plan

- Middleware: `requireAuth` + перевірка `role === 'ADMIN'`
- Дія: `Report.findByIdAndUpdate(id, { $unset: { learningPlan: '' } }, { new: true })`
- Відповідь: оновлений звіт (без `learningPlan`)
- Помилки: 404 якщо звіт не знайдено, 403 якщо не адмін

### 2. PATCH /api/reports/:id/learning-plan

- Middleware: `requireAuth` + перевірка `role === 'ADMIN'`
- Body: `{ tasks: { topicTitle: string; description: string; isCompleted: boolean; completedAt?: string; response?: string }[] }`
- Валідація: масив не порожній, кожна задача має `topicTitle` і `description`
- Дія: замінює `learningPlan.tasks` (зберігає `generatedAt` і `deadline`)
- Відповідь: оновлений звіт

### 3. POST /api/reports/:id/generate-learning-plan (зміна існуючого)

- Якщо `req.user.role === 'ADMIN'` — прибрати ідемпотентну перевірку `if (report.learningPlan) return res.json(report)`.
- Для звичайного користувача поведінка не змінюється.

---

## Frontend

### Нові функції в `reportsService.ts`

```ts
deleteLearningPlan(reportId: string): Promise<AuditResult>
// DELETE /api/reports/:id/learning-plan

updateLearningPlanTasks(reportId: string, tasks: LearningTask[]): Promise<AuditResult>
// PATCH /api/reports/:id/learning-plan  body: { tasks }
```

### Зміни в `AdminReportsListView.tsx`

**Новий стан:**
```ts
const [editingPlan, setEditingPlan] = useState(false);
const [editTasks, setEditTasks] = useState<LearningTask[]>([]);
const [planActionLoading, setPlanActionLoading] = useState(false);
const [planError, setPlanError] = useState<string | null>(null);
```

**Панель "План навчання" — якщо план існує:**

Заголовок рядка: `<p>План навчання</p>` + кнопки праворуч:
- **Редагувати** (`fa-pen`) — `setEditTasks([...selected.learningPlan.tasks]); setEditingPlan(true)`
- **Перестворити** (`fa-rotate`) — `confirm()` → `deleteLearningPlan` → `generateLearningPlan` (обидва sequential)
- **Видалити** (`fa-trash-can`) — `confirm()` → `deleteLearningPlan` → оновити `selected` і `reports`

**Панель "План навчання" — якщо план відсутній:**

Кнопка **"Згенерувати план"** — `confirm()` або просто клік → `generateLearningPlan`. Показує спінер під час генерації. Вимога: `aiRecommendations` має існувати та tier має бути `below85` або `range85to94`.

**Модалка редагування задач:**

- Список задач, кожна задача:
  - `input` для `topicTitle` (однорядковий)
  - `textarea` для `description` (3 рядки)
- Кнопки: "Скасувати" / "Зберегти" (викликає `updateLearningPlanTasks`)
- Під час збереження — `planActionLoading = true`, кнопка задизейблена

**Після будь-якої успішної дії:**
```ts
const merged = { ...selected, ...updated } as ReportWithUser;
setSelected(merged);
setReports(prev => prev.map(r => (r._id ?? r.id) === (merged._id ?? merged.id) ? merged : r));
```

---

## Error Handling

- Всі помилки показуються через `planError` під панеллю плану (аналогічно до `aiError`)
- Скидати `planError` на початку кожної дії

---

## Out of Scope

- Додавання нових задач адміном
- Зміна `deadline` або `generatedAt`
- Відмічання задач як виконаних адміном
