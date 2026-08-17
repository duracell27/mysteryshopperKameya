# Інтеграція онбордингу 14 днів — Design Spec

**Дата:** 2026-08-17  
**Джерело:** `internshipKameya`  
**Ціль:** `mysteryshopperKameya`

---

## Контекст

`mysteryshopperKameya` — 3-модульний застосунок (таємний покупець / онбординг / навчання).  
Вкладка «Онбординг 14 днів» зараз є заглушкою (`OnboardingView` з текстом "Розділ в розробці").  
Задача: перенести повний функціонал 14-денного онбордингу з `internshipKameya` з адаптацією до TypeScript, наявної системи юзерів і дизайн-токенів (`kameya-burgundy`).

Треки 30 і 60 днів — окрема задача, поза цією специфікацією.

---

## Що НЕ переносимо

| Компонент із internshipKameya | Причина |
|-------------------------------|---------|
| `UsersManager` | Вже є `UsersView` в адміні |
| `EventsLog` | Є своя система логів (`SystemLog`) |
| `LoginPage`, `AuthContext` | Своя авторизація |
| `Navigation` | Своя `Layout` |
| `User` / `Event` моделі | Вже є |
| Auth routes | Вже є |

---

## Бекенд

### 1. Middleware — `adminOnly`

В `backend/src/middleware/auth.ts` додати:

```ts
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) return res.status(403).json({ message: 'Доступ заборонено' });
  next();
};
```

### 2. Модель `DayPlan.ts`

Файл: `backend/src/models/DayPlan.ts`

```
DayPlan {
  day: Number (unique, required)
  isHoliday: Boolean (default: false)
  tasks: Task[]
}

Task (subdocument) {
  title: String (required)
  description: String (default: '')
  type: 'theory' | 'practice' | 'meeting' | 'observation' | 'other' (default: 'other')
}
```

### 3. Модель `Trainee.ts`

Файл: `backend/src/models/Trainee.ts`

```
Trainee {
  user: ObjectId → User (required, unique)
  startDate: Date (default: now)
  days: TraineeDay[]
  aiReports: AiReport[]
  timestamps: true
}

TraineeDay (subdocument) {
  day: Number (required)
  completedTaskIds: ObjectId[]
  reflection?: Reflection
}

Reflection (_id: false) {
  q1: Number   (настрій 1-5)
  q2: Number   (зрозумілість матеріалу 1-5)
  q3: Number   (комфорт у салоні 1-5)
  q4: String   (стресори — відкрите питання)
  q5: Number   (лояльність до Камеї 1-5)
  comments: String
  submittedAt: Date
}

AiReport {
  analysis: String (required)
  daysCount: Number (required)
  createdAt: Date (default: now)
}
```

`toPublic(populatedUser, dayPlans)` — метод як в internshipKameya:  
- обчислює `currentDay` від `startDate`  
- повертає `isCompleted`, `endDate`  
- кожен день: `isPreview` (майбутній), `tasks` з прапором `completed`, `reflection`

Position стажера береться з `User.position` (вже є) — окреме поле в Trainee не потрібне.

### 4. Роут `dayplan.ts`

Файл: `backend/src/routes/dayplan.ts`

| Метод | Шлях | Доступ | Дія |
|-------|------|--------|-----|
| GET | `/api/dayplans` | auth | Всі плани |
| POST | `/api/dayplans` | admin | Створити день |
| DELETE | `/api/dayplans/:day` | admin | Видалити день |
| POST | `/api/dayplans/:day/tasks` | admin | Додати задачу |
| PATCH | `/api/dayplans/:day/tasks/:taskId` | admin | Оновити задачу |
| DELETE | `/api/dayplans/:day/tasks/:taskId` | admin | Видалити задачу |

### 5. Роут `trainee.ts`

Файл: `backend/src/routes/trainee.ts`

| Метод | Шлях | Доступ | Дія |
|-------|------|--------|-----|
| GET | `/api/trainees/me` | auth | Профіль стажера (поточний юзер) |
| PATCH | `/api/trainees/me/tasks/:taskId` | auth | Відмітити задачу |
| PUT | `/api/trainees/me/days/:day/reflection` | auth | Зберегти рефлексію |
| GET | `/api/trainees` | admin | Всі стажери |
| POST | `/api/trainees/:userId` | admin | Створити профіль стажера |
| PATCH | `/api/trainees/:id` | admin | Оновити startDate |

### 6. Роут `onboardingAi.ts`

Файл: `backend/src/routes/onboardingAi.ts`

| Метод | Шлях | Доступ | Дія |
|-------|------|--------|-----|
| POST | `/api/onboarding-ai/analyze` | admin | AI-аналіз рефлексій стажера |

Промпт і логіка — як в internshipKameya. SDK Anthropic вже встановлений.  
Результат зберігається в `Trainee.aiReports`.

### 7. Реєстрація роутів у `index.ts`

```ts
import dayplanRoutes from './routes/dayplan';
import traineeRoutes from './routes/trainee';
import onboardingAiRoutes from './routes/onboardingAi';

app.use('/api/dayplans', dayplanRoutes);
app.use('/api/trainees', traineeRoutes);
app.use('/api/onboarding-ai', onboardingAiRoutes);
```

---

## Фронтенд

### 1. Типи — `types.ts`

Додати інтерфейси:

```ts
Task, DayPlan, Reflection, AiReport, Trainee
```

Скопійовано з `internshipKameya/frontend/src/types/index.ts` (вже TypeScript-сумісні).  
`Screen` enum: додати `ADMIN_ONBOARDING = 'ADMIN_ONBOARDING'`.

### 2. Сервіс `onboardingService.ts`

Файл: `frontend/src/services/onboardingService.ts`

Функції (використовують наявний `authFetch`/`apiFetch` патерн проекту):
- `getMyTrainee()` → `GET /api/trainees/me`
- `toggleTask(taskId)` → `PATCH /api/trainees/me/tasks/:taskId`
- `submitReflection(day, data)` → `PUT /api/trainees/me/days/:day/reflection`
- `getAllTrainees()` → `GET /api/trainees`
- `createTrainee(userId, startDate)` → `POST /api/trainees/:userId`
- `updateTrainee(id, data)` → `PATCH /api/trainees/:id`
- `getDayPlans()` → `GET /api/dayplans`
- `createDay(day, isHoliday)` → `POST /api/dayplans`
- `deleteDay(day)` → `DELETE /api/dayplans/:day`
- `addTask(day, task)` → `POST /api/dayplans/:day/tasks`
- `updateTask(day, taskId, data)` → `PATCH /api/dayplans/:day/tasks/:taskId`
- `deleteTask(day, taskId)` → `DELETE /api/dayplans/:day/tasks/:taskId`
- `analyzeTrainee(traineeId, traineeName, days)` → `POST /api/onboarding-ai/analyze`

### 3. Компоненти стажера

#### `OnboardingView.tsx` (замінити заглушку)

Файл: `frontend/src/components/onboarding/OnboardingView.tsx`

Логіка:
- При маунті — `getMyTrainee()`. Якщо 404 — показати "Ваш профіль стажера ще не створено".
- Якщо дані є: горизонтальна стрічка `DayCard` + панель поточного дня.
- `track` prop ("14") поки не впливає на логіку (один трек).

#### `DayCard.tsx`

Файл: `frontend/src/components/onboarding/DayCard.tsx`

Порт з internshipKameya. Стилі — `kameya-burgundy` (вже використані там).  
Стани: active, completed, preview (сірий), today (підпис).

#### `TaskItem.tsx`

Файл: `frontend/src/components/onboarding/TaskItem.tsx`

Чекбокс + назва задачі + опис + тип. При кліку — `toggleTask(taskId)`.  
Задачі в `isPreview`-дні не можна відмічати.

#### `ReflectionForm.tsx`

Файл: `frontend/src/components/onboarding/ReflectionForm.tsx`

5 полів:
- q1 (1-5): Як ваш настрій сьогодні?
- q2 (1-5): Наскільки зрозумілий матеріал дня?
- q3 (1-5): Комфорт у салоні?
- q4 (текст): Що вас стресувало або дивувало?
- q5 (1-5): Ваша лояльність до Камеї?
- comments (текст): Довільний коментар

При submit — `submitReflection(day, data)`. Форма недоступна для `isPreview`-днів.

### 4. Адмін-компоненти

#### `AdminOnboardingView.tsx`

Файл: `frontend/src/components/admin/AdminOnboardingView.tsx`

Дві вкладки:

**Вкладка 1 — "Стажери":**
- Список активних стажерів: ім'я, посада, поточний день, прогрес-бар
- При виборі стажера: всі його дні, рефлексії, кнопка "AI-аналіз"
- Блок збережених AI-звітів (accordion)
- Кнопка "Додати стажера" → вибір юзера з наявних + вибір дати початку

**Вкладка 2 — "Управління планом":**
- Список днів 1-14, кнопка "Додати день"
- При виборі дня: список задач + редагування/видалення/додавання задач
- Чекбокс "Вихідний" на день

#### `Screen.ADMIN_ONBOARDING` в `App.tsx`

В `renderAdminScreen()`:
```tsx
case Screen.ADMIN_ONBOARDING:
  return <AdminOnboardingView />;
```

#### `Layout.tsx`

В `ADMIN_NAV` додати:
```ts
{ id: Screen.ADMIN_ONBOARDING, label: 'Онбординг', icon: 'fa-user-clock' }
```

---

## Залежності та порядок реалізації

```
1. auth.ts → adminOnly
2. DayPlan.ts model
3. Trainee.ts model
4. dayplan.ts route
5. trainee.ts route
6. onboardingAi.ts route
7. index.ts (реєстрація)
8. types.ts (типи + Screen enum)
9. onboardingService.ts
10. DayCard.tsx
11. TaskItem.tsx
12. ReflectionForm.tsx
13. OnboardingView.tsx (замінити заглушку)
14. AdminOnboardingView.tsx
15. App.tsx (додати case)
16. Layout.tsx (додати до ADMIN_NAV)
```

---

## Граничні випадки

- Стажер без профілю (`/api/trainees/me` → 404): показати повідомлення замість контенту
- Рефлексія вже подана: форма показує збережені дані, кнопка "Оновити"
- День ще не настав (`isPreview`): задачі видно, але не можна відмічати; рефлексія прихована
- Стажування завершено (`isCompleted`): всі дні пройдені, можна переглядати рефлексії
- `DayPlan` відсутній для якогось дня: `toPublic` показує лише дні з планами

---

## Що залишаємо на майбутнє

- Треки 30 і 60 днів (окрема специфікація)
- Фільтр "завершені стажування" в адміні (є в internshipKameya як окрема вкладка)
- Сповіщення про подання рефлексії (є в internshipKameya через `logEvent`)
