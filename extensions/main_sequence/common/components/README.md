# Main Sequence Common Components

This folder contains reusable UI building blocks shared by nested Main Sequence extensions.

## Components

- `MainSequenceDataGrid.tsx`: reusable TanStack-based data grid for namespace-scoped tabular payloads such as weights and other backend-driven result sets.
- `MainSequenceEntitySummaryCard.tsx`: renders the shared `SummaryResponse` contract returned by entity and list summary endpoints, including optional warning banners from `summary_warning` plus a compact inline labels field driven by `summary.label_management` when the backend exposes add/remove label URLs. Summary fields can show either shared Lucide glyphs or frontend-supplied image icons, and inline code/text values keep their full raw value on hover even when the rendered summary truncates them. Link fields pass their complete action metadata, including `href` and `iframe`, to the owning feature's click handler.
- `MainSequenceEntitySummaryEditorDialog.tsx`: shared dialog wrapper for editing summary-backed entities.
- `MainSequenceDataSourcePickerField.tsx`: data-source-specific picker wrapper that always gives
  each option a leading data-source visual, using a resolved physical source logo when present and
  a generic database fallback otherwise.
- `MainSequencePermissionsTab.tsx`: permissions management UI for shareable entities, backed by searchable transfer lists for view and edit assignment workflows. It accepts shareable object uids, and it assumes the shared Main Sequence permission contract where the caller provides an object root and object uid while the API layer supplies the configured permission suffixes.
- `MainSequenceRegistryPagination.tsx`: pagination control used by registry-style tables.
- `MainSequenceRegistrySearch.tsx`: shared search input used by registry screens.
- `MainSequenceResourceRequirementsSection.tsx`: shared resource-requirements form section,
  field wrapper, and Spot/Standard toggle used by Main Sequence job, release, and agent
  creation/deployment forms. It also owns the shared secondary `Estimate cost` action that posts
  resource selections to `/orm/api/pods/billing/estimate-runtime-cost/` and renders total, CPU,
  memory, and GPU costs using the backend-provided units.
- `MainSequenceSelectionCheckbox.tsx`: table-selection checkbox helper.
- `PickerField.tsx`: searchable picker/dropdown used by forms and dialogs.
- `dataSourcePickerOptions.ts`: shared project and physical data-source picker option builders.
  Use these builders with `MainSequenceDataSourcePickerField` for data-source selectors so class
  types, statuses, search keywords, and icons stay consistent across project create/settings and
  project-data-source editor flows.
- `physicalDataSourceIcons.ts`: local class-type to icon resolver used by the physical data source
  registry and data-source pickers. It prefers bundled logos over backend-provided image paths and
  ignores symbolic non-image logo values such as `database`.
- `permissionEntityId.ts`: normalizes permission principal identifiers from both legacy `id` and
  UID-shaped user/team payloads. Permission pickers ignore records without a usable identifier
  instead of passing malformed values into the RBAC matrix.
- `projectImagePickerOptions.ts`: shared project-image picker metadata builders, including tag prioritization and the shared `ms-sdk...` visibility rule.
- `registryTable.ts`: shared table column and row helpers for registry layouts.

## Rules

- Keep this folder limited to components reused across nested extensions or intended as namespace-wide building blocks.
- If a component is only used by one feature, move it into that feature folder and document it there.
