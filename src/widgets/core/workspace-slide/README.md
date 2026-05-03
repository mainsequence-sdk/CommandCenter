# Workspace Slide Widget

This widget is a structural presentation container that lives directly on the normal Workspaces
canvas.

## Purpose

- Renders a slide-like bounded surface with `header`, `left`, `body`, `right`, and `footer`
  regions.
- Keeps `body` as the only required region; `header`, `footer`, `left`, and `right` are optional.
- Opens with a taller default height so adding a slide feels closer to dropping a presentation
  page than a shallow dashboard card.
- Marks region boundaries for normal workspace widgets instead of owning embedded widget snapshots.
- Keeps multiple slides visible on one workspace so authors can compose several slides in the same
  top-level canvas.

## Entry Points

- `definition.ts`: widget metadata, registry contract, and settings wiring.
- `slide-model.ts`: slide prop types, legacy embedded-slide migration helpers, and constants for
  slide-region layout.
- `WorkspaceSlideWidget.tsx`: slide shell renderer plus divider-drag behavior.
- `WorkspaceSlideWidgetSettings.tsx`: top-level optional-region controls and authoring guidance.

## Maintenance Notes

- ADR 050 defines the target architecture: `Slide` behaves like a structural container similar to
  `Row`, and slide-contained widgets must stay normal workspace widgets rendered by the shared
  workspace host.
- The slide widget props now own only slide-shell concerns such as region enablement and divider
  positions. They should not become a second widget store again.
- Existing embedded slide widgets are migrated through `extractLegacyWorkspaceSlideChildren(...)`
  in `slide-model.ts` and promoted into normal workspace widget instances with slide-region
  placement metadata.
- Saved-widget import/export now preserves `slidePlacement` metadata for slide-contained widgets.
  Group imports remap slide child ownership to the newly created slide ids when the saved payload
  includes both the slide widget and its contained widgets.
- Duplicating a slide from the workspace canvas must also duplicate every slide-contained widget
  that references that slide id, including nested row children and any internal bindings among the
  duplicated slide descendants.
- Existing root-canvas widgets can be dragged directly into visible slide regions during workspace
  edit mode, and slide-contained widgets can also be dragged back out to the root canvas or into a
  different slide region. Those transfers rewrite `slidePlacement` and move the widget between
  layout hosts without duplicating the widget.
- The slide surface itself does not expose inline `Add widget` buttons anymore. Widget insertion is
  expected to happen naturally by dragging normal workspace widgets into the slide.
- At the root workspace canvas, the slide behaves like a structural full-width widget. It stays
  anchored at `x = 0`, spans the full canvas width, and is not horizontally resizable.
- Widgets placed inside a slide must be rendered through the normal workspace widget host, not a
  private nested widget renderer. The current shared renderer lives in
  `src/features/dashboards/WorkspaceCanvasWidgetHost.tsx`, while the slide subgrid host only owns
  region-local layout.
- Slide regions are bounded subgrids with a fixed logical row height. They rely on the scaled
  logical slide canvas instead of per-surface row-height drift, so slide composition stays stable
  between edit mode and slideshow mode.
- The slide surface now renders from one fixed logical 16:9 canvas that is uniformly scaled to fit
  the editor and slideshow surfaces. Keep authoring/runtime visual tweaks compatible with that
  scale-first model so slide composition does not drift between edit mode and presentation mode.
- Presentation-oriented callers can now opt into a tighter frame fit so mobile slideshow viewports
  maximize the slide before introducing extra stage padding.
- Optional region presence is tracked through `headerEnabled`, `footerEnabled`, `leftEnabled`, and
  `rightEnabled`. The separate `showHeader` prop is reserved for the outer widget-frame header
  visibility.
- Region dimensions are adjusted on canvas by dragging visible delimiters rather than by editing
  percentage inputs in widget settings.
- Region separators are visible while editing and transparent in view mode so the slide reads as a
  cleaner presentation stage.
- Keep `USAGE_GUIDANCE.md` aligned with the actual region ownership model and authoring flow.
