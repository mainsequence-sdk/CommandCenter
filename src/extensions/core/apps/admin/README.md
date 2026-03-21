# Admin

This app is owned by the core extension.

Keep the admin app implementation in this folder:

- shared in-app navigation and surface chrome
- organization-facing admin tools and future operator surfaces that belong to the built-in admin domain

Registration stays in:

- `src/extensions/core/index.ts`

Current surfaces in this folder:

- `AdminOrganizationUsersPage.tsx`: organization user registry backed by the shared user endpoint
  with email-only user creation plus bulk delete and org-admin role actions
- `AdminActivePlansPage.tsx`: organization subscription inventory and per-user plan assignments
  backed by `/user/api/organization/<id>/active-plans/` with inline assign/remove seat controls
  plus a `Manage seats` modal loaded from `/user/api/organization/<id>/subscription-seats/`
  and submitted to the matching org-scoped POST checkout endpoint
- `AdminGithubOrganizationsPage.tsx`: GitHub organization registry backed by the pod-manager
  `github-organization` endpoint with connect-start, bulk delete, and project-import actions
- `AdminInvoicesPage.tsx`: billing invoice registry backed by `/orm/api/pods/billing/invoices/`
  with cursor pagination, `origin_url` fallback support, and View/PDF invoice actions
- `AdminBillingDetailsPage.tsx`: billing usage table backed by `/orm/api/pods/billing/usage/`
  with a summary header from `/orm/api/pods/billing/summary/`, `datetime-local`
  range filters, and quick date presets

Maintenance notes:

- Add new admin surfaces here instead of reviving `src/features/admin/`
- Keep the app extension-owned so admin navigation, favorites, and search stay consistent with
  `Access & RBAC`
- Legacy `/app/admin-panel` links should continue redirecting into this app
- Keep organization user bulk actions aligned with `/user/api/user/` backend endpoints and
  their confirmation semantics
