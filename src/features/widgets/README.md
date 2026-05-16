# Widget Features

This module owns widget discovery and widget-specific explorer flows. The catalog is exposed as a
surface inside the Workspaces app navigation, while per-widget details are dedicated routes for
metadata, ports, and usage guidance.

## Entry Points

- `WidgetCatalogPage.tsx`: registry browser for all registered widgets, mounted from the Workspaces
  app surface `workspace-studio/widget-catalog`.
- `WidgetExplorerPage.tsx`: per-widget details page for catalog metadata, ports, configuration,
  usage guidance, and demo-only widget previews when a widget ships mock preview fixtures. The
  file name is legacy; the page must not mount live widget previews.
- `widget-explorer.tsx`: shared path utilities plus legacy preview-mode helpers still referenced by
  widget code.

## Detail Behavior

- The catalog route renders a compact table for widget selection. Full descriptions, IO ports,
  configuration fields, examples, and capabilities belong on the widget details route.
- The details route may mount widget components only through the demo preview path backed by
  `mockProps`, `mockResolvedInputs`, and `mockRuntimeState`. It must not resolve live workspace
  bindings, run widget execution, or open source runtimes.
- Widgets that expose a configuration schema document their field sections and which fields are
  eligible to be exposed directly on the canvas.

## Maintenance Notes

- Schema-backed widgets should keep section titles, field descriptions, and pop-to-canvas metadata
  accurate because the details route uses that metadata as documentation.
