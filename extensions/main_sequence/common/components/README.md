# Main Sequence Common Components

This folder contains reusable UI building blocks shared by nested Main Sequence extensions.

## Components

- `MainSequenceDataGrid.tsx`: reusable TanStack-based data grid for namespace-scoped tabular payloads such as weights and other backend-driven result sets.
- `MainSequenceEntitySummaryCard.tsx`: renders the shared `SummaryResponse` contract returned by entity and list summary endpoints, including optional warning banners from `summary_warning` plus a compact inline labels field that saves on Enter and removes labels from each chip close action when the summary is marked `labelable`. Inline code/text values keep their full raw value on hover even when the rendered summary truncates them.
- `MainSequenceEntitySummaryEditorDialog.tsx`: shared dialog wrapper for editing summary-backed entities.
- `MainSequencePermissionsTab.tsx`: permissions management UI for shareable entities, backed by searchable transfer lists for view and edit assignment workflows. It accepts either numeric or string object ids, and it assumes the shared Main Sequence permission contract where the caller provides an object root and object id while the API layer supplies the configured permission suffixes.
- `MainSequenceRegistryPagination.tsx`: pagination control used by registry-style tables.
- `MainSequenceRegistrySearch.tsx`: shared search input used by registry screens.
- `MainSequenceSelectionCheckbox.tsx`: table-selection checkbox helper.
- `PickerField.tsx`: searchable picker/dropdown used by forms and dialogs.
- `registryTable.ts`: shared table column and row helpers for registry layouts.

## Rules

- Keep this folder limited to components reused across nested extensions or intended as namespace-wide building blocks.
- If a component is only used by one feature, move it into that feature folder and document it there.
