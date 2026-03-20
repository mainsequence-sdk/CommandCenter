# Main Sequence Components

This folder contains reusable UI building blocks that are specific to the Main Sequence extension.

## Components

- `MainSequenceEntitySummaryCard.tsx`: renders summary header payloads returned by entity summary endpoints.
- `MainSequenceEntitySummaryEditorDialog.tsx`: shared dialog wrapper for editing summary-backed entities.
- `MainSequencePermissionsTab.tsx`: permissions management UI for shareable entities.
- `MainSequenceRegistryPagination.tsx`: pagination control used by registry-style tables.
- `MainSequenceRegistrySearch.tsx`: shared search input used by registry screens.
- `MainSequenceSelectionCheckbox.tsx`: table-selection checkbox helper.
- `PickerField.tsx`: searchable picker/dropdown used by forms and dialogs.
- `registryTable.ts`: shared table column and row helpers for registry layouts.

## Rules

- Keep this folder limited to components reused across features or intended as extension-wide building blocks.
- If a component is only used by one feature, move it into that feature folder and document it there.
