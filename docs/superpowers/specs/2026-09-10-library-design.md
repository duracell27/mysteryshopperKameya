# Корпоративна бібліотека — Design Doc

**Дата:** 2026-09-10  
**Статус:** Затверджено  

---

## 1. Контекст і мета

Додати до застосунку Kameya модуль корпоративної бібліотеки фізичних книг. Співробітники замовляють книги через додаток, адмін фізично доставляє книгу на відділ/магазин і підтверджує це в системі. Повернення — симетричний процес: співробітник робить запит, адмін підтверджує отримання. Доступ регулюється через існуючу Access Matrix.

---

## 2. Обмеження та рішення

- Тільки фізичні книги, по одному примірнику.
- Термін позики — 30 днів. Адмін може подовжити вручну.
- SMS-нагадування: за 3 дні до dueDate і на наступний день після (прострочення).
- Співробітник не бачить, хто тримає книгу — тільки статус "Недоступна".
- При поверненні співробітник може оцінити книгу від 1 до 10.
- Рейтинг книги = середнє всіх оцінок по закритих позиках.
- Доступ до модуля — через Access Matrix (`library: boolean`).
- Один співробітник може мати лише одну активну позику одночасно (статус `pending`/`active`/`return_pending`). API повертає 409, якщо співробітник намагається замовити другу книгу.

---

## 3. Моделі даних

### 3.1 `BookGenre`

```ts
{
  name: string  // унікальний
}
```

### 3.2 `Book`

```ts
{
  title:      string
  author:     string
  genreId:    ObjectId → BookGenre
  coverUrl:   string
  annotation: string
  isActive:   boolean       // м'яке видалення
  avgRating:  number        // кешується при кожному поверненні з оцінкою
  ratingsCount: number      // кількість оцінок
  createdAt:  Date
  updatedAt:  Date
}
```

`isActive=false` не дозволяє нові замовлення. Видалення фізично заборонене, якщо є активна позика.

### 3.3 `BookLoan`

```ts
{
  bookId:               ObjectId → Book
  userId:               ObjectId → User
  status:               'pending' | 'active' | 'return_pending' | 'returned' | 'cancelled'
  requestedAt:          Date
  deliveredAt?:         Date        // адмін підтвердив видачу
  dueDate?:             Date        // deliveredAt + 30 днів (або після подовження)
  dueDateExtendedAt?:   Date        // коли адмін востаннє подовжив
  returnRequestedAt?:   Date
  returnedAt?:          Date
  rating?:              number      // 1–10, заповнює співробітник при поверненні
  warningDay27Sent:     boolean     // нагадування (dueDate - 3 дні)
  warningDay31Sent:     boolean     // нагадування (прострочення)
}
```

Книга вважається зайнятою, якщо існує `BookLoan` з `status` в `['pending', 'active', 'return_pending']`.

### 3.4 Зміни в `AccessMatrix`

Додати `library: boolean` до `modules` в `IAccessRule` і `DEFAULT_RULES`. За замовчуванням `false` для всіх.

---

## 4. API-маршрути

Базовий префікс: `/api/library`. Всі маршрути захищені `authMiddleware`.

### 4.1 Жанри

| Метод | Шлях | Роль | Дія |
|-------|------|------|-----|
| GET | `/genres` | всі | список жанрів |
| POST | `/genres` | адмін | створити жанр |
| PUT | `/genres/:id` | адмін | перейменувати |
| DELETE | `/genres/:id` | адмін | видалити (якщо немає книг у жанрі) |

### 4.2 Книги

| Метод | Шлях | Роль | Дія |
|-------|------|------|-----|
| GET | `/books` | всі | список з фільтрами: `genre`, `status` (`available`/`borrowed`), `search`, `page` |
| GET | `/books/:id` | всі | деталі книги + поточна активна позика (для адміна) |
| POST | `/books` | адмін | додати книгу |
| PUT | `/books/:id` | адмін | редагувати |
| DELETE | `/books/:id` | адмін | `isActive=false` (заборонено якщо книга на руках) |

### 4.3 Позики

| Метод | Шлях | Роль | Дія |
|-------|------|------|-----|
| POST | `/loans` | співробітник | запит на книгу (`pending`) |
| GET | `/loans` | адмін | всі позики з фільтрами: `status`, `overdue`, `userId`, `bookId` |
| GET | `/loans/my` | співробітник | активна позика + повна історія |
| PATCH | `/loans/:id/deliver` | адмін | підтвердити видачу → `active`, `dueDate = now+30d` |
| PATCH | `/loans/:id/extend` | адмін | подовжити: `{ days: number }` → оновити `dueDate`, скинути warning-прапорці |
| PATCH | `/loans/:id/request-return` | співробітник | запит на повернення → `return_pending`, опціонально `{ rating: number }` |
| PATCH | `/loans/:id/confirm-return` | адмін | підтвердити повернення → `returned`, оновити `avgRating` у `Book` |
| PATCH | `/loans/:id/cancel` | адмін / власник | скасувати `pending`-запит → `cancelled` |

---

## 5. SMS-нагадування (cron)

**Файл:** `backend/src/services/libraryReminderService.ts`  
**Запуск:** щодня о 10:00 через `node-cron` в `index.ts`

```
Логіка:
1. Знайти всі BookLoan зі status='active'
2. Для кожної:
   a. daysLeft = dueDate - today
   b. якщо daysLeft <= 3 і warningDay27Sent=false:
      → SMS співробітнику "Нагадування: поверніть книгу «{title}» до {dueDate}"
      → warningDay27Sent = true
   c. якщо daysLeft < 0 і warningDay31Sent=false:
      → SMS співробітнику "Термін повернення книги «{title}» минув"
      → warningDay31Sent = true
```

При `extend`: `dueDate` оновлюється, обидва прапорці скидаються в `false`.

---

## 6. Фронтенд

### 6.1 Нові маршрути

```
/library                     → LibraryView (співробітник)
/library/my-loans            → MyLoansView (співробітник)
/admin/library/books         → AdminLibraryBooksView (адмін)
/admin/library/loans         → AdminLibraryLoansView (адмін)
```

### 6.2 Нові компоненти (`frontend/src/components/library/`)

**`LibraryView.tsx`** — каталог для співробітника:
- Фільтр по жанру (таби або дропдаун), пошук по назві/автору
- Картки книг: обкладинка, назва, автор, жанр, середній рейтинг (зірки + число)
- Статус: зелена кнопка "Замовити" (вільна) або сірий бейдж "Недоступна" (зайнята — без деталей хто тримає)

**`MyLoansView.tsx`** — сторінка "Мої книги":
- **Активна позика** (якщо є): обкладинка, назва, залишилось N днів з кольоровим індикатором (≥7 — зелений, 3–6 — жовтий, <3 або прострочено — червоний), кнопка "Повернути"
- **Модалка повернення**: поле рейтингу 1–10 зірок (необов'язково), кнопка підтвердження
- **Історія** внизу: список книг, дати і виставлена оцінка

**`AdminLibraryBooksView.tsx`** — керування каталогом:
- Таблиця книг з фільтрами (жанр, статус, пошук)
- Колонки: обкладинка, назва, автор, жанр, рейтинг, статус (вільна/зайнята), дії
- Кнопки: додати книгу, редагувати, деактивувати
- Модалка редагування: поля назва, автор, жанр, обкладинка (upload), анотація
- Окрема секція/таб "Жанри": CRUD жанрів

**`AdminLibraryLoansView.tsx`** — керування позиками:
- Фільтри: статус, прострочені, пошук по користувачу/книзі
- Картки або рядки: співробітник, книга, статус, дедлайн, скільки залишилось
- Дії: підтвердити видачу, подовжити термін (input: кількість днів), підтвердити повернення, скасувати

### 6.3 Нові сервіси та контекст

- `frontend/src/services/libraryService.ts` — всі запити до `/api/library/*`
- `AccessContext.tsx` — додати `canLibrary` поряд з `canShop`

### 6.4 Навігація (`Layout.tsx` / сайдбар)

- Співробітник: новий пункт "Бібліотека" → `/library` (видимий лише якщо `canLibrary`)
- Адмін: в акордеоні додається розділ "Бібліотека" з підпунктами "Каталог" і "Запити"

---

## 7. Структура нових файлів

```
backend/src/
  models/
    BookGenre.ts
    Book.ts
    BookLoan.ts
  routes/
    library.ts
  services/
    libraryReminderService.ts

frontend/src/
  components/library/
    LibraryView.tsx
    MyLoansView.tsx
    AdminLibraryBooksView.tsx
    AdminLibraryLoansView.tsx
  services/
    libraryService.ts
```

---

## 8. Відкриті питання

- Завантаження обкладинок: реалізувати через існуючий механізм upload (як аватари/товари в магазині).
- Кешування `avgRating` в `Book`: оновлювати при кожному `confirm-return` з оцінкою — це атомарна операція, race condition малоймовірний при одному примірнику.
- `node-cron` вже використовується в проекті або треба встановити — уточнити під час реалізації.
