# Instruments

This feature owns the Main Sequence Markets instruments surface.

## Entry Points

- `MainSequenceInstrumentsPage.tsx`: quick editor for the current instrument configuration.

## Backend Contract

- `GET /orm/api/assets/instruments-configuration/current/`: returns the current org-scoped
  configuration plus the currently selected node labels.
- `PATCH /orm/api/assets/instruments-configuration/current/`: updates the selected storage-node ids.
- `listDataNodes(...)` from `../../../../common/api/`: powers the searchable node pickers.

## Notes

- The screen is intentionally narrow and edit-focused rather than a registry.
- Keep data-node picker behavior local to this feature unless another Markets settings screen needs it.
