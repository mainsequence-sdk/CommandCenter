# Widget Features

This module owns widget discovery and widget-specific explorer flows. The catalog is exposed as a
surface inside the Workspaces app navigation, while per-widget details are dedicated routes for
metadata, ports, and usage guidance.

## Entry Points

- `WidgetCatalogPage.tsx`: registry browser for all registered widgets, mounted from the Workspaces
  app surface `workspace-studio/widget-catalog`.
- `WidgetExplorerPage.tsx`: per-widget details page for catalog metadata, ports, configuration, and
  usage guidance. The file name is legacy; the page no longer mounts live widget previews.
- `widget-explorer.tsx`: shared path utilities plus legacy preview-mode helpers still referenced by
  widget code.

## Detail Behavior

- The catalog route renders a compact table for widget selection. Full descriptions, IO ports,
  configuration fields, examples, and capabilities belong on the widget details route.
- The details route does not mount live widget components or mock runtime behavior.
- Widgets that expose a configuration schema document their field sections and which fields are
  eligible to be exposed directly on the canvas.

## Maintenance Notes

- Schema-backed widgets should keep section titles, field descriptions, and pop-to-canvas metadata
  accurate because the details route uses that metadata as documentation.
