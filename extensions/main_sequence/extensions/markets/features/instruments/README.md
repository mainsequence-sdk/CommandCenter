# Instruments

This feature owns the Main Sequence Markets instruments surface.

## Entry Points

- `MainSequenceInstrumentsPage.tsx`: quick editor for the current instrument configuration.

## Backend Contract

- `GET /orm/api/assets/instruments-configuration/current/`: returns the current org-scoped
  configuration plus the currently selected node labels.
- `PATCH /orm/api/assets/instruments-configuration/current/`: updates the selected storage-node ids.
- `listDataNodes(...)` from `../../../../common/api/`: powers the searchable node pickers.
- `fetchDataNodeDetail(...)` from `../../../../common/api/`: automatically resolves the currently
  selected node ids so the picker always shows the real assigned node labels.

## Notes

- The screen is intentionally narrow and edit-focused rather than a registry.
- The picker fields stay read-only until the user enters edit mode from the pencil action in the page header.
- Keep data-node picker behavior local to this feature unless another Markets settings screen needs it.
