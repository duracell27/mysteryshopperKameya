# Shop (Магазин винагород) — Design Spec

**Date:** 2026-09-07  
**Status:** Approved  

---

## Overview

A reward shop where employees spend accumulated points to order prizes. Admin manages the product catalog and processes orders manually by advancing order status. Points are deducted at order time and refunded on cancellation.

---

## Data Models

### `ShopProduct` (new model)

```ts
{
  name:        string    // назва товару
  description: string    // опис
  imageUrl:    string    // /uploads/products/<filename>
  price:       number    // ціна в балах (positive integer)
  quantity:    number    // залишок; 0 = недоступний для замовлення
  isActive:    boolean   // false = прихований з каталогу (не видалений)
  createdAt, updatedAt
}
```

### `ShopOrder` (new model)

```ts
{
  userId:   ObjectId   // ref: User
  productId: ObjectId  // ref: ShopProduct
  productSnapshot: {   // знімок на момент замовлення (назва, ціна, imageUrl)
    name:     string
    price:    number
    imageUrl: string
  }
  pointsSpent: number  // = product.price at time of order
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  adminNote?: string   // опціональна нотатка адміна
  createdAt, updatedAt
}
```

> `productSnapshot` ensures historical order data is stable even if the product is edited later.

### Changes to existing models

**`PointsTransaction.reason`** — extend enum with:
- `'shop_purchase'` — `pointsAwarded` is negative (deduction)
- `'shop_refund'`   — `pointsAwarded` is positive (refund on cancellation)

**`AccessMatrix.IAccessRule.modules`** — add:
- `shop: boolean` (default: `false`)

**`AccessMatrix.DEFAULT_RULES`** — add `shop: false` to every existing rule entry.

---

## Backend Routes

File: `backend/src/routes/shop.ts` (new file, registered in `index.ts`)  
Upload dir: `uploads/products/` (created at startup like `uploads/avatars/`)

### Products

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/shop/products` | user | Active products only (`isActive: true, quantity > 0` shown; out-of-stock shown greyed) |
| `GET` | `/api/shop/products/all` | admin | All products including hidden |
| `POST` | `/api/shop/products` | admin | Create product — `multipart/form-data` with image upload via multer |
| `PUT` | `/api/shop/products/:id` | admin | Edit name, description, price, quantity, isActive |
| `POST` | `/api/shop/products/:id/image` | admin | Replace product image |
| `DELETE` | `/api/shop/products/:id` | admin | Delete product (only if no orders reference it; otherwise set `isActive: false`) |

### Orders

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/shop/orders` | user | Place order — deducts points atomically |
| `GET` | `/api/shop/orders/my` | user | Own order history |
| `GET` | `/api/shop/orders` | admin | All orders — supports `?status=`, `?search=`, `?page=`, `?limit=` |
| `GET` | `/api/shop/orders/pending-count` | admin | Count of `pending` orders for menu badge |
| `PUT` | `/api/shop/orders/:id/status` | admin | Change status; triggers refund logic on `cancelled` |

### Order placement logic (`POST /api/shop/orders`)

1. Verify product is active and `quantity > 0`
2. Verify `user.points >= product.price`
3. Atomically:
   - `User.points -= product.price`
   - `ShopProduct.quantity -= 1`
4. Create `ShopOrder` with `status: 'pending'`
5. Create `PointsTransaction` with `reason: 'shop_purchase'`, `pointsAwarded: -product.price`
6. Return created order with updated user points balance

### Cancellation logic (`PUT /api/shop/orders/:id/status` → `cancelled`)

Only allowed when current status is `pending` or `in_progress` (not `completed`).

1. `User.points += order.pointsSpent`
2. `ShopProduct.quantity += 1`
3. Create `PointsTransaction` with `reason: 'shop_refund'`, `pointsAwarded: +order.pointsSpent`
4. Update order status to `cancelled`

---

## Frontend Structure

### New files

```
frontend/src/
  components/
    shop/
      ShopView.tsx              # employee — product catalog
      MyOrdersView.tsx          # employee — own order history
      AdminShopProductsView.tsx # admin — product management
      AdminShopOrdersView.tsx   # admin — all orders, search, status
  services/
    shopProductsService.ts
    shopOrdersService.ts
```

### Navigation changes (`Layout.tsx`)

- Add **"Магазин"** nav item (icon: `fa-store`) — visible only when `access.shop === true`
- Add **"Замовлення"** admin nav item with red badge showing pending count (polled every 60s via `shopOrdersService.getPendingCount()`)

### `ShopView.tsx` — employee catalog

- Responsive grid of product cards: image, name, points price, stock badge
- Card states:
  - Normal — "Замовити" button enabled
  - Out of stock (`quantity === 0`) — card greyed, button disabled "Немає в наявності"
  - Insufficient points (`user.points < price`) — button disabled "Недостатньо балів"
- On "Замовити" click → confirm modal:  
  *"Замовити [назва]? З вашого рахунку буде списано [X] балів. Ваш залишок: [Y → Y-X] балів."*
- On confirm → POST order → refresh `user.points` in `AuthContext`

### `MyOrdersView.tsx` — employee order history

- List of orders: product image thumbnail, name, price, date, status badge
- Status badge colors: `pending`=yellow, `in_progress`=blue, `completed`=green, `cancelled`=grey

### `AdminShopProductsView.tsx` — admin product management

- Table: image thumbnail, name, price (pts), quantity, active/hidden badge, actions
- Actions per row: Edit (inline or modal), Toggle visibility, Delete
- "Додати товар" button → form modal: name, description, price, quantity, image upload
- On delete: if product has orders → set `isActive: false` instead of hard delete (backend enforces)

### `AdminShopOrdersView.tsx` — admin orders

- Table: date, employee name, product name (from snapshot), points spent, status dropdown
- Search input: filters by employee name or product name (client-side on loaded page, or server `?search=`)
- Status filter tabs or dropdown: All / Pending / In Progress / Completed / Cancelled
- Status change: dropdown in each row → on change → `PUT /api/shop/orders/:id/status`
- On `cancelled` → backend handles refund; frontend refreshes row
- Pagination: server-side, default 20 per page

### `AccessContext.tsx` changes

- Add `shop: boolean` to the access object derived from `AccessMatrix`

### `Screen` type changes (`types.ts`)

- Add: `'shop'`, `'myOrders'`, `'adminShopProducts'`, `'adminShopOrders'`

---

## Access Control

- `AccessMatrix.modules.shop` controls visibility for each division/position combo
- Admin always sees admin-side views regardless of matrix
- `GET /api/shop/products` returns 403 if user's matrix entry has `shop: false`

---

## File Storage

- Upload directory: `uploads/products/` (created at server startup)
- Static serving: `app.use('/uploads/products', express.static(...))` — same pattern as avatars
- Multer config: same as `avatarUpload`, stored as `<timestamp>-<random>.<ext>`
- On product image replace: old file deleted from disk before saving new one

---

## Out of Scope

- Shopping cart (multi-item orders)
- Per-division product availability
- Product categories
- Employee notifications (only admin gets the badge counter)
- Real-time WebSocket updates (polling is sufficient)
