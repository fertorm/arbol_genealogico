# User Management & Roles — Design Document
**Date:** 2026-03-22
**Status:** Approved

---

## Problem

When a shared tree link is opened on Android, all navigation and buttons are blocked because the app uses an anonymous UUID stored in `localStorage` as identity. If the UUID doesn't match `creator_id` on members, the entire canvas goes read-only. There is also no way to distinguish between trusted editors and casual visitors.

---

## Goals

- Replace anonymous UUID identity with Google OAuth (Supabase Auth)
- Add 3 roles per tree: `owner`, `editor`, `viewer`
- Editors can propose changes; owner approves them (appear immediately as "pending")
- Anonymous visitors (no login) can navigate + use Soltar, but cannot edit
- Add deceased indicator (✝ icon + muted card style + death year field)
- Migrate existing trees without losing data

---

## Architecture

### Authentication
- **Supabase Auth + Google OAuth**
- `supabase.auth.signInWithOAuth({ provider: 'google' })`
- `MY_ID` (localStorage UUID) replaced by `supabase.auth.getUser().id`
- Anonymous visitors have no session; they get implicit `viewer` access

### New Table: `tree_roles`
```sql
tree_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id     uuid REFERENCES trees(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(tree_id, user_id)
)
```
- Creator of a tree is automatically inserted as `owner`
- Editor link opens tree and triggers insert as `editor` (requires Google login)

### Modified Table: `members`
New columns added:
```sql
ALTER TABLE members ADD COLUMN status text DEFAULT 'approved'
  CHECK (status IN ('approved', 'pending', 'rejected'));
ALTER TABLE members ADD COLUMN deceased boolean DEFAULT false;
ALTER TABLE members ADD COLUMN death_year text;
```
- All existing members default to `status = 'approved'`
- Editors insert members with `status = 'pending'`
- Owner updates `status` to `'approved'` or `'rejected'`

### Row Level Security (RLS)
| Action | Owner | Editor | Viewer (anon) |
|--------|-------|--------|---------------|
| SELECT members | ✅ | ✅ | ✅ |
| INSERT member | ✅ | ✅ (pending) | ❌ |
| UPDATE member | ✅ | own only | ❌ |
| DELETE member | ✅ | own pending only | ❌ |
| UPDATE status | ✅ | ❌ | ❌ |
| INSERT connection | ✅ | ✅ | ❌ |

---

## UI / UX

### Home Screen
- Existing buttons: "Abrir árbol" + "Crear nuevo árbol"
- New button: **[G Iniciar con Google]**
- If session active → skip to tree or recent list

### Header — Role Indicator
```
👑 Dueño  |  ✏️ Editor  |  👁️ Visitante
```
Small badge next to tree title shows current role.

### Pending Changes Badge
- Only visible to owner
- `🔔 Pendientes (N)` button in header when N > 0
- Opens modal listing all pending members with [✓ Aprobar] [✕ Rechazar] actions

### Pending Member Visual Style
- Dashed yellow border: `border: 2px dashed #D4A017`
- Small `⏳ pendiente` label on card
- Visible to everyone (owner, editors, visitors)

### Deceased Member Visual Style
- Border color: `#6B6B6B` (dark grey)
- Card background slightly desaturated
- `✝` icon top-right corner of photo area
- Death year shown below birth year: `✝ 1998`

### Share Modal — Role Links
```
🔗 Link visitante  → ?tree=ID              (view only)
✏️ Link editor     → ?tree=ID&role=editor  (requires Google login to edit)
```
Only owner sees the editor link option.

### Add/Edit Member Form
New fields:
- `☐ Persona fallecida` checkbox
- `Año de fallecimiento` (text, shows only when checkbox checked)

---

## Approval Workflow

```
Editor clicks "+ Agregar"
  → member inserted with status: "pending"
  → card appears with dashed yellow border + "⏳ pendiente"

Owner opens tree
  → sees "🔔 Pendientes (N)" in header
  → opens approval modal
  → clicks ✓ Aprobar → status: "approved" → card renders normally
     or ✕ Rechazar → status: "rejected" → card removed from view
```

---

## Migration of Existing Trees

Existing trees have members with `creator_id` = old anonymous UUID.
On first Google login, user sees:

```
"¿Tienes árboles creados anteriormente?
 Pega el link de tu árbol para reclamarlo."
[Reclamar árbol]  [Omitir]
```

Claiming a tree: inserts a `tree_roles` row with `role: 'owner'` for the new Google user_id.
Old `creator_id` UUID fields remain in the DB but are no longer used for permission checks.

---

## Soltar (Anonymous Access)

- Visitors without login can open any member card and tap "💌 Soltar"
- Letter is saved with `author_id: null` if no session
- No changes to the Soltar feature logic

---

## Out of Scope

- Email notifications (not in this version)
- Transferring tree ownership
- Multiple owners per tree
- Offline editing
