# Demo Extension

This extension owns the mock application boundary for Command Center.

## Entry Points

- `index.ts`: registers the Demo app and the mock-only widget catalog entries.
- `app.ts`: defines the Demo app surfaces and dashboard layouts.
- `LegacyDemoRedirect.tsx`: preserves legacy `/app/markets` routes by redirecting them into the
  Demo app shell.
- `features/`: page-level Demo features.
- `widgets/`: mock-only widgets that should disappear when `VITE_USE_MOCK_DATA=false`.

## Owned Assets

- the `demo` application surfaces
- the narrative market brief page
- the mock-only `yield-curve-plot` widget
- the mock-only `heatmap-matrix-chart` widget

## Maintenance Notes

- Keep all mock-only application code here instead of re-homing it under `core` or live vendor
  extensions.
- This extension is explicitly marked `mockOnly` in its `AppExtension` definition. The registry
  removes mock-only extensions entirely when `VITE_USE_MOCK_DATA=false`, so none of this folder's
  apps, widgets, or themes should appear in live mode.
