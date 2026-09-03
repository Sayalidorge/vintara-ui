# Role-based sidebar menu — design (not yet implemented)

## Problem

We now have 5 roles instead of 2: `SUPER_ADMIN`, `ADMIN`, `RECEPTION`, `USER`,
`PROPERTY_MANAGER`. Each role should see a different set of sidebar menu items,
and today there are two hardcoded, duplicated layouts (`AdminLayout.jsx`,
`UserLayout.jsx`) with hardcoded `<li>` menu items.

Constraint: roles are maintained in the backend (`/users/roles`,
`User.role` enum). We don't want to touch frontend code every time a role is
added or a role's capabilities change.

## Decision: permission-based RBAC (not role→menu mapping)

Standard practice (same pattern as Auth0 / AWS IAM / Firebase): don't map
menu items directly to role names. Map them to **permissions**, and let the
backend own which permissions each role grants.

```
Backend:  role -> [permissions]         (changes often, backend-only edit)
Frontend: menu item -> requiredPermission  (changes rarely, only on new features)
```

### Backend changes needed (not in this repo)

- `POST /auth/login` response gains a field:
  ```json
  {
    "token": "...",
    "role": "ADMIN",
    "permissions": ["view_dashboard", "manage_resorts", "view_revenue", "..."]
  }
  ```
- Computed server-side from the user's role at login time. No new endpoint
  required — permissions refresh on next login (acceptable UX; same as how
  role changes already require re-login today).
- Adding/editing a role = backend-only change to its permission set. No
  frontend deploy needed.

### Frontend changes needed (this repo)

1. `src/constants/roles.js` — `ROLES` enum (`SUPER_ADMIN`, `ADMIN`,
   `RECEPTION`, `USER`, `PROPERTY_MANAGER`) matching backend strings, mainly
   for readability/typo-safety.
2. `src/constants/menuConfig.js` — single source of truth for all sidebar
   items, each tagged with the permission key it requires, e.g.:
   ```js
   { key: "resorts", label: "Resorts", path: "/admin/resorts", icon: FaHotel, requiredPermission: "manage_resorts" }
   ```
   Merges the current items from both `AdminLayout.jsx` (Dashboard, Resorts,
   Users, Enquiries, Leaves, Revenue, Expenses, Property Collection, Monthly
   Settlement) and `UserLayout.jsx` (Dashboard, Create Booking, Inventory,
   Daily Entry, Leave Portal, Food Collection).
3. `src/components/Layout.jsx` — single unified layout replacing both
   `AdminLayout.jsx` and `UserLayout.jsx`. Reads `user.permissions` from
   localStorage (stored at login same as `user.role` today), filters
   `menuConfig` by `permissions.includes(item.requiredPermission)`, renders
   one sidebar/header/`<Outlet/>` shell for every role. Reuses the existing
   shared `UserLayout.css` (already used by both current layouts).
4. `src/App.js` — both the `/admin` and `/user` route trees use the same
   `<Layout />` element instead of `<AdminLayout />` / `<UserLayout />`. Route
   paths stay the same (no broken deep links).
5. Delete `AdminLayout.jsx` and `UserLayout.jsx` once `Layout.jsx` replaces
   them.
6. `ProtectedRoute.jsx` currently only checks "is logged in" — worth
   revisiting later to also guard direct URL navigation to a route the
   user's permissions don't include (today anyone logged in can type
   `/admin/...` in the URL bar regardless of role).

## Why this instead of hardcoding role→menu in frontend

A frontend `roles: ["ADMIN", "SUPER_ADMIN"]` array per menu item works, but
every new role or role-capability change requires a frontend code change and
redeploy. Permission-based filtering means the frontend only changes when an
actual new feature/page is added (which needs code anyway) — role additions
and capability tweaks stay entirely backend-side.

## Status

Design agreed 2026-08-05. Not implemented yet — waiting on backend to add
`permissions` to the login response before wiring the frontend pieces above.
