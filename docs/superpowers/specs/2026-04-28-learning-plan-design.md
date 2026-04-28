# Learning Plan — Design Spec
**Date:** 2026-04-28

## Overview

Розширення секції "Твій план росту" на дашборді працівника: генерація персонального плану навчання на основі слабких пунктів аудиту та PDF зі стандартами обслуговування. Плюс оновлення UX для тіру 95-99% і святковий віджет для 100%.

---

## Scope

Зачіпає:
- `ScoreInsightCard` (фронтенд) — зміни кнопок і логіки по всіх тірах
- Dashboard секція "Ваш план навчання" — показ чекбоксів плану
- `AdminReportsListView` — нова панель "План навчання" в деталях звіту
- Backend: новий сервіс парсингу PDF, два нові ендпоінти, розширена модель звіту

НЕ зачіпає: `TrainingPlanView` (стара 15-денна заглушка), `QuizView`, `ProgressView`.

---

## Data Model

### Нові типи (backend `Report` model + frontend `types.ts`)

```ts
interface ILearningTask {
  topicTitle: string;      // Заголовок теми/проблеми
  description: string;     // Що треба зробити (посилання на розділ стандартів)
  isCompleted: boolean;
  completedAt?: Date;
}

interface ILearningPlan {
  tasks: ILearningTask[];  // 6 задач для <85%, 2-3 для 85-94%
  generatedAt: Date;
}
```

`IReport` отримує нове опціональне поле: `learningPlan?: ILearningPlan`

Mongoose схема для `LearningTask`:
```ts
{ topicTitle: String, description: String, isCompleted: Boolean, completedAt: Date }
```

---

## Backend

### PDF Storage & Chunking Service

**Файл:** `backend/data/standards.pdf` — статичний файл, адмін кладе вручну один раз.

**Сервіс:** `backend/src/services/standardsService.ts`

- Залежність: npm пакет `pdf-parse`
- **Lazy-ініціалізація:** при першому виклику `getChunks()` парсить PDF, ділить на чанки, кешує в пам'яті. При рестарті сервера — перечитує.
- **Стратегія чанкування:** split по рядках-заголовках розділів (regex: рядки що починаються з `\d+[\.\d]*\s` або UPPERCASE довжиною > 5 символів). Кожен чанк: `{ index: number, title: string, content: string }`.
- Якщо PDF не знайдено — логує warning, повертає порожній масив (генерація продовжується без контексту стандартів).

### Нові ендпоінти

#### `POST /api/reports/:id/generate-learning-plan`
- Доступ: власник звіту або ADMIN
- Умова: `report.aiRecommendations` має існувати (слабкі пункти вже є)
- Якщо `report.learningPlan` вже є — повертає існуючий (idempotent)
- **Крок 1 (cheap):** надсилає Claude `haiku` тільки заголовки всіх чанків + перелік слабких пунктів → Claude повертає JSON масив індексів релевантних чанків (max 4-6 чанків)
- **Крок 2 (main):** надсилає Claude `haiku` тільки відібрані чанки + слабкі пункти → Claude повертає JSON масив задач
- Кількість задач: 6 для `below85` (2 на слабкий пункт × 3), 2-3 для `range85to94`
- Кожна задача: `{ topicTitle, description }` — description має посилатись на конкретний розділ стандартів
- Атомарне збереження через `findOneAndUpdate` з `{ $exists: false }` (захист від race condition)
- Повертає оновлений звіт

#### `PATCH /api/reports/:id/learning-plan/:taskIndex`
- Доступ: тільки власник звіту
- Toggles `tasks[taskIndex].isCompleted` (якщо `false → true`, встановлює `completedAt: new Date()`, якщо `true → false`, очищає `completedAt`)
- Валідація: `taskIndex` — ціле число в межах масиву
- Повертає оновлений звіт

---

## Frontend

### ScoreInsightCard — зміни по тірах

**Стан компонента:**
```ts
const [learningPlanLoading, setLearningPlanLoading] = useState(false);
```
`onInsightUpdated` вже є — через нього передається оновлений звіт з планом.

**below85 (до підтвердження):**
- Слабкі пункти — без змін
- Textarea "Яка твоя ціль до наступної перевірки?" — залишається
- Кнопка: `"Ознайомитись і скласти план навчання"` (disabled поки goalText порожній)
- При кліку:
  1. `submitScoreInsight({ goalText })` → `onInsightUpdated(updated)`
  2. `setLearningPlanLoading(true)` → `generateLearningPlan(reportId)` → `onInsightUpdated(updated)` → `setLearningPlanLoading(false)`
  3. Помилка генерації плану — логується, не блокує UX (scoreInsight вже збережено)

**range85to94 (до підтвердження):**
- Слабкий пункт — без змін
- Кнопка: `"Ознайомитись і скласти план навчання"`
- Та сама логіка: confirm + generateLearningPlan

**range95to99 (до підтвердження):**
- Textarea "Що допомогло тобі досягти такого результату?" — вже є (використовує `ai.question`)
- Кнопка: `"Ознайомитись"` (замість "Поділитись")
- Disabled поки textarea порожня — вже так і є

**perfect100:**
- Повністю перероблений святковий віджет (детальніше нижче)

**Після підтвердження (insight є):**
- Read-only view залишається як зараз для всіх тірів
- Для below85/85-94: під слабкими пунктами додається статус плану ("Формуємо план..." або "План навчання складено ✅")

### 100% Святковий віджет

CSS `@keyframes` (без зовнішніх бібліотек):
- `pulseGlow`: картка пульсує золотим сяйвом (`box-shadow`)
- `floatStars`: 6-8 абсолютно позиціонованих зірочок анімуються (`translateY` + `opacity`) з різним `animation-delay`
- `scaleIn`: поява картки через `scale(0.8) → scale(1)` при монтуванні

Вміст:
```
🏆  (велика іконка, анімована)
Ідеальна перевірка!
Ви досягали 100% вже X разів   ← perfectCount з allReports
[Відзначити досягнення]  ← якщо !insight
✅ Зафіксовано             ← якщо insight є
```

### Dashboard — секція "Ваш план навчання"

Поточний блок (full-width, третій рядок) отримує prop `learningPlan` та `learningPlanLoading` з Dashboard.

Dashboard має `const [learningPlanLoading, setLearningPlanLoading] = useState(false)`. ScoreInsightCard отримує новий prop `onLearningPlanLoading: (loading: boolean) => void` і викликає його при старті/завершенні генерації.

| Стан | Рендер |
|---|---|
| `learningPlanLoading === true` | Спіннер + "Складаємо ваш план навчання..." |
| `lastAudit.learningPlan` є | Список задач згрупованих по `topicTitle`, чекбокс + description |
| Інакше | Поточний плейсхолдер без змін |

**Чекбокс кліку:**
- Optimistic UI: локально toggles `isCompleted`
- `PATCH /api/reports/:id/learning-plan/:taskIndex` у фоні
- При помилці — revert + показати коротке повідомлення

### Admin — деталі звіту

В `AdminReportsListView` detail view, новий блок після "AI Рекомендації":

```
План навчання
─────────────
[якщо немає] "План ще не згенеровано"
[якщо є]
  Задача 1: topicTitle
    ✅/⬜ description  [дата якщо виконано]
  Задача 2: ...
```

Адмін бачить лише read-only (без можливості змінювати чекбокси).

---

## Error Handling

- PDF не знайдено: `generateLearningPlan` повертає 503 з відповідним повідомленням
- Claude повернув невалідний JSON на кроці 2: retry тільки крок 2 один раз (з тими самими чанками), якщо знову fail — 500
- `taskIndex` out of bounds: 400
- Мережева помилка при toggle чекбоксу: optimistic revert + toast

---

## Out of Scope

- Адмін завантаження/оновлення PDF через UI
- Нотифікації адміну про виконані задачі
- План навчання для тіру 95-99% та perfect100
