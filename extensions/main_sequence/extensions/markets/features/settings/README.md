# Settings

This feature owns the Main Sequence Markets settings surface.

## Entry Points

- `MainSequenceMarketsSettingsPage.tsx`: read-only settings view for public app metadata, runtime
  assumptions, and backend documentation links.

## Backend Contract

- `GET /api/v1/settings/`: returns the public Markets app metadata, runtime configuration
  assumptions, documentation URLs, and assumption rows for the frontend settings screen.
- `fetchMarketsSettings()` from `../../../../common/api/`: typed shared transport for the settings
  payload.

## Notes

- This screen is intentionally read-only. It must not infer hidden identity, secret, or mutation
  fields that are outside the public response contract.
- Documentation links should resolve against the Markets backend root, including
  `VITE_DEBUG_MAIN_SEQUENCE` when local development points Markets at a separate service.
