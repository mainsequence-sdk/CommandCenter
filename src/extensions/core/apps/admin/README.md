# Organization Admin

This app is owned by the core extension.

Keep the admin app implementation in this folder:

- shared in-app navigation and surface chrome
- organization-facing admin tools that belong to the built-in organization-admin domain

Registration stays in:

- `src/extensions/core/index.ts`

Current surfaces in this folder:

- `AdminOrganizationUsersPage.tsx`: organization user registry backed by the shared user endpoint
  with optional first/last-name user creation, visible name columns in the registry table, plus
  bulk delete and org-admin role actions
- `AdminWidgetConfigurationsPage.tsx`: organization widget-type configuration inventory and CRUD
  surface for widgets that advertise organization-scoped configuration capability, including raw
  JSON override editing, backend registration status, and override-row deletion
- `AdminActivePlansPage.tsx`: organization subscription inventory and per-user plan assignments
  backed by `/user/api/organization/<uid>/active-plans/` with inline assign/remove seat controls
  plus a `Manage seats` modal loaded from `/user/api/organization/<uid>/subscription-seats/`
  and submitted to the matching org-scoped POST checkout endpoint, including explicit upgrade
  handling for the `organization_plan_assignment_upgrade_required` assignment-gating response
- `AdminLoginSessionsPage.tsx`: organization-scoped login-session registry backed by
  `/user/api/organization/<uid>/login-sessions/` with search, auth-source/state filters, paginated
  results, and per-session revoke action through the matching org-scoped revoke endpoint
- `AdminGithubOrganizationsPage.tsx`: GitHub organization registry backed by the pod-manager
  `github-organization` endpoint with connect-start, bulk delete, and organization-click
  repository discovery through `/orm/api/pods/github-organization/{uid}/repositories/` plus
  selective project import through `/orm/api/pods/github-organization/{uid}/repositories/import/`.
  This surface treats GitHub organization records as UID-addressed resources and sends bulk
  actions with `uids`; numeric backend ids are not part of the frontend contract.
- `AdminInvoicesPage.tsx`: billing invoice registry backed by `/orm/api/pods/billing/invoices/`
  with cursor pagination, `origin_url` fallback support, and View/PDF invoice actions
- `AdminBillingDetailsPage.tsx`: billing usage table backed by `/orm/api/pods/billing/usage/`
  with a summary header from `/orm/api/pods/billing/summary/`, `datetime-local`
  range filters, and quick date presets
- `AdminHostedResourcesPage.tsx`: billing-owned hosted infrastructure surface with local tab
  navigation. The first `Databases` tab is wired to the hosted Timescale billing catalog and
  expects plan-driven CRUD around
  `/orm/api/pods/mainsequence-hosted/billing/hosted-resources/timescaledb-databases/` plus the
  matching `/plans/` endpoint, whose catalog is grouped by provider and flattened locally for the
  picker UI.
- `AdminManageCreditsPage.tsx`: organization credit overview backed by
  `/user/api/organization/<uid>/credits/` with action-driven prepaid-credit checkout,
  editable auto-reload settings, and org-admin per-user credit-budget management backed by the
  matching `/user/api/organization/<uid>/credits/` sub-actions

Maintenance notes:

- Add new admin surfaces here instead of reviving `src/features/admin/`
- Keep the app extension-owned so admin navigation, favorites, and search stay consistent with
  `Access & RBAC`
- This app is for organization-scoped administration only. Platform-only controls belong in the
  separate `Admin Settings` modal, not in this app. That now includes explicit widget-registry
  publication.
- Legacy `/app/admin-panel` links should continue redirecting into this app
- Keep organization user bulk actions aligned with `/user/api/user/` backend endpoints and
  their confirmation semantics
- Billing surfaces currently span both pod-manager billing endpoints and the org-admin
  `/user/api/organization/<uid>/credits/` credit endpoints; keep that split explicit in the
  page-level API helpers instead of normalizing paths ad hoc in components
- Credit-management UI must display money in dollars while submitting integer cents to the
  backend, and should prefer action/form URLs returned by the organization credits endpoint over
  re-deriving those paths in the page component
- The `Manage seats` dialog must treat the
  `organization_seat_management_upgrade_required` 403 contract from
  `/user/api/organization/<uid>/subscription-seats/` as an explicit upgrade state, not a generic
  access error or a derived role/group heuristic
- Active-plan assignment POST failures from
  `/user/api/organization/<uid>/active-plans/<user_id>/` must surface the backend
  `organization_plan_assignment_upgrade_required` title/detail/upgrade message directly instead of
  collapsing them into a generic toast
