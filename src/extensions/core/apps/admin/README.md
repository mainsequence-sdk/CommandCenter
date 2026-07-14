# Organization Admin

This app is owned by the core extension.

These pages are now reached through the routed Settings module under `/app/settings/*`. The legacy
`admin` app registration stays in place for compatibility and for the existing admin page metadata,
but the primary shell no longer exposes a separate Organization Admin topbar button.

Keep the admin app implementation in this folder:

- shared in-app navigation and surface chrome for legacy/direct admin routes
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
- `AdminMainSequenceMarketsPage.tsx`: organization application setting that selects the
  `command_center.adapter_from_api` connection marked with the
  `main_sequence_markets` / `primary-api` binding. It updates connection public config metadata and
  clears duplicate Markets bindings from other Adapter From API connections.
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
  with a top budget summary built from `/user/api/user/credits/summary/`, `datetime-local`
  range filters, and quick date presets
- `AdminHostedResourcesPage.tsx`: billing-owned managed database surface reached at
  `/app/settings/billing/hosted-resources/databases`. It uses the generic hosted resource database
  workflow under
  `/orm/api/connections/mainsequence-hosted/billing/hosted-resources/databases/`: hydrate the buy
  flow only from `/plans/`, never call a quote endpoint, render extension/version/compute
  tier/compute shape/storage/backup/HA/maintenance-window controls, compute the
  displayed create/edit pricing from the public pricing catalog, and submit create with the
  prorated `expected_total_amount_cents` due-now value as a stale-price guard. Allocation rows must
  open hosted-resource detail through
  `/orm/api/connections/mainsequence-hosted/billing/hosted-resources/databases/{allocation_uid}/`;
  direct physical data-source navigation belongs inside that detail view, not in the registry row.
  Immediate delete is a per hosted resource action and must stay available from the registry row by
  using the fixed `/{allocation_uid}/cancel-now/` route whenever the row has a hosted resource UID,
  even if the list payload does not include an `actions.cancel_now` block.
  Hosted-resource detail linked resources should be rendered as concept links where a detail surface
  exists. `allocation_uid` is the Hosted resource UID. `data_source_uid` is the Connection data
  source link. `dynamic_table_data_source_uid` is the Project data source link, not a wrapper label.
  Do not invent a generic Resource detail link from the nested `resource` object.
  Hosted database credentials are represented by `credential`; `credential.uid` is a hosted
  credential reference and must not be linked to or displayed as a generic Secret. Reveal and
  rotate buttons must come from `credential.actions.reveal` and `credential.actions.rotate`;
  `secret_uid`, `actions.reveal_credentials`, and `actions.rotate_credentials` are not part of the
  current hosted database response contract.
  The same modal shell must support create, hosted resource summary, edit/resize through PATCH,
  failed-provisioning remediation by PATCH on the same hosted resource, explicit credential reveal and
  rotate actions, and immediate delete through the `cancel-now` endpoint. Detail may show passwordless connection and network-access information returned by the
  normal detail payload, but password-bearing credentials must only be revealed after the explicit
  `/credentials/reveal/` or `/credentials/rotate/` POST. The flow must not render or submit region
  selectors, backend provider fields, Azure SKU, meter IDs, server IDs, or other provider
  internals.
- `AdminManageCreditsPage.tsx`: organization credit overview backed by
  `/user/api/organization/<uid>/credits/` with action-driven prepaid-credit checkout,
  editable auto-reload settings, and org-admin per-user credit-budget management backed by the
  matching `/user/api/organization/<uid>/credits/` sub-actions

Maintenance notes:

- Add new admin surfaces here instead of reviving `src/features/admin/`
- Keep the pages extension-owned so their API helpers, confirmations, and organization gates remain
  unchanged while Settings owns the new navigation container.
- This folder is for organization-scoped administration only. Platform-only controls belong in the
  Platform group of the routed Settings module.
- Do not add standalone admin route namespaces back. These pages are Settings-owned surfaces and
  should be opened through `/app/settings/*`.
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
