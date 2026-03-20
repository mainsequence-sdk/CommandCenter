# Main Sequence Common Hooks

This folder contains reusable hooks shared across Main Sequence nested extensions.

## Files

- `useRegistrySelection.ts`: shared selection state helper for registry-style tables.

## Notes

- Hooks here should be Main Sequence-specific UI helpers, not generic app-wide hooks.
- If a hook becomes generally useful across the app shell, move it out of the extension and document the new location.
