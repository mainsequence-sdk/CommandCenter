# Main Sequence Extension

This extension contains the Main Sequence application surfaces and the supporting API, hooks, and reusable UI used by those surfaces.

## Structure

- `api/`: typed REST client helpers and response models for Main Sequence endpoints.
- `components/`: shared extension-specific UI pieces reused across multiple features.
- `features/`: feature-owned screens and larger workflows grouped by domain.
- `widgets/`: extension-local widgets registered with the core widget platform.
- `hooks/`: reusable extension hooks that are not tied to a single screen.
- `index.ts`: extension registration and surface wiring.

## Maintenance Notes

- Keep reusable pieces in `components/` only when they are used by more than one feature or are intended to be shared.
- Keep feature-specific components inside their feature folder, even if they are large.
- When adding a new folder here, include a `README.md` for that folder.
