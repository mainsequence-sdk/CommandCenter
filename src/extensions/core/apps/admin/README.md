# Admin

This app is owned by the core extension.

Keep the admin app implementation in this folder:

- shared in-app navigation and surface chrome
- operational page surfaces such as the event stream
- future operator tools that belong to the built-in admin domain

Registration stays in:

- `src/extensions/core/index.ts`

Current surfaces in this folder:

- `AdminConsolePage.tsx`: admin-owned wrapper around the current operational dashboard
- `AdminEventStreamPage.tsx`: current control-plane event stream
- `AdminOrganizationUsersPage.tsx`: organization user registry backed by the shared user endpoint
  with email-only user creation plus bulk delete and org-admin role actions
- `AdminActivePlansPage.tsx`: organization subscription inventory and per-user plan assignments
  backed by `/user/api/organization/<id>/active-plans/` with inline assign/remove seat controls
- `AdminGithubOrganizationsPage.tsx`: GitHub organization registry backed by the pod-manager
  `github-organization` endpoint with connect-start, bulk delete, and project-import actions
- `adminConsoleDashboard.ts`: dashboard definition reused by the admin console page

Maintenance notes:

- Add new admin surfaces here instead of reviving `src/features/admin/`
- Keep the app extension-owned so admin navigation, favorites, and search stay consistent with
  `Access & RBAC`
- Legacy `/app/admin-panel` links should continue redirecting into this app
- Keep organization user bulk actions aligned with `/user/api/user/` backend endpoints and
  their confirmation semantics
