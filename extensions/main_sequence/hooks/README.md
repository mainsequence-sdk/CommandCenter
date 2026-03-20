# Main Sequence Hooks

This folder contains reusable hooks scoped to the Main Sequence extension.

## Files

- `useRegistrySelection.ts`: shared selection state helper for registry-style tables.

## Notes

- Hooks here should be UI-framework helpers for the extension, not generic app-wide hooks.
- If a hook becomes generally useful across the app shell, move it out of the extension and document the new location.
