# Widget Features

This module owns widget discovery and widget-specific explorer flows that sit outside the
dashboard canvas.

## Entry Points

- `WidgetCatalogPage.tsx`: registry browser for all registered widgets.
- `WidgetExplorerPage.tsx`: per-widget documentation and live preview page rendered in its own tab.
- `widget-explorer.tsx`: shared explorer helpers, preview-mode boundary, and path utilities.

## Preview Behavior

- The explorer route renders the real widget component, not a separate demo implementation.
- Explorer previews run with isolated mock data adapters and an isolated React Query client so
  they do not reuse live cached responses from the main app shell.
- Widget runtime state in the explorer stays local to the page and is discarded when the tab
  closes.

## Maintenance Notes

- New widgets should provide `mockProps` when `exampleProps` are not enough to render a useful
  explorer preview.
- Data-backed widgets should keep their explorer preview compatible with `isWidgetPreviewMode()`
  so the route can stay mock-only without changing normal application behavior.
