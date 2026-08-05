# Avatar Upload Design

**Date:** 2026-08-05  
**Status:** Approved

## Context

Admin can upload a photo for any user. The avatar is displayed in the admin panel (user table/edit form) and in the user's own Layout header. Storage is local disk (same pattern as existing audio uploads via multer).

## Requirements

- Admin uploads avatar for any user via the admin panel
- Avatar displayed in: admin UsersView table, admin edit modal, Layout header for the logged-in user
- Storage: local disk at `uploads/avatars/<userId>.<ext>`
- Served statically via Express at `/uploads/avatars/<filename>`
- Max file size: 2MB
- Accepted types: `image/*` (jpg, png, webp)
- If no avatar: show initials placeholder (first letter of name, or phone last 4 digits)

## Architecture

### Backend

**New endpoint:** `POST /api/users/:id/avatar`
- Admin-only (requires `isAdmin`)
- Multer middleware: `diskStorage` to `uploads/avatars/`, filename `<userId>.<ext>`
- Overwrites previous avatar for same user (same filename)
- Updates `user.avatarUrl` with the relative path `/uploads/avatars/<filename>`
- Returns `{ avatarUrl: string }`

**User model:** add `avatarUrl?: string` field (optional, no default)

**Static serving:** `backend/src/index.ts` — add `app.use('/uploads', express.static('uploads'))` so avatars are reachable at `http://localhost:3001/uploads/avatars/<file>`

### Frontend — Admin (UsersView)

- In the user table row: circular avatar (32px) left of the name, or initials fallback
- In the edit modal: larger avatar preview (64px) with an upload button below it
- On file select: POST to `/api/users/:id/avatar` with `FormData`, update local user state with returned `avatarUrl`
- No separate save step — upload fires immediately on file select

### Frontend — User Layout

- `AuthUser` type gains `avatarUrl?: string`
- Login response includes `avatarUrl`
- In Layout header: circular avatar (32px) showing photo or initials fallback
- Initials fallback: first letter of `user.name`, or `?` if no name

## Data Flow

```
Admin selects file
  → POST /api/users/:id/avatar (multipart/form-data)
  → multer saves uploads/avatars/<userId>.jpg
  → User.avatarUrl updated in MongoDB
  → Response: { avatarUrl: '/uploads/avatars/<userId>.jpg' }
  → Frontend updates user row + edit modal preview

User logs in
  → Login response includes avatarUrl
  → JWT payload includes avatarUrl
  → Layout header shows avatar
```

## Out of Scope

- User uploading their own avatar (admin-only upload)
- Deleting/clearing avatar
- Image cropping or resizing
- CDN or cloud storage
