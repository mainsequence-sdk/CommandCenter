# Workspace Slide Widget

This widget is a structural presentation container that lives directly on the normal Workspaces
canvas.

## Purpose

- Renders a fixed-aspect slide surface with one bounded `body` widget stage.
- Optionally renders `header` and `footer` bands owned by the slide widget itself.
- Keeps auxiliary slide bands simple and explicit instead of treating them as extra widget canvases.
- Keeps multiple slides visible on one workspace so authors can compose several slides in the same
  top-level canvas.

## Entry Points

- `definition.ts`: widget metadata, registry contract, and settings wiring.
- `slide-model.ts`: slide prop types, legacy embedded-slide migration helpers, and constants for
  body-stage layout plus header/footer slot content.
- `WorkspaceSlideWidget.tsx`: slide shell renderer, header/footer slot rendering, and divider-drag
  behavior.
- `WorkspaceSlideWidgetSettings.tsx`: top-level header/footer toggles and slot-content authoring.

## Maintenance Notes

- ADR 050 defines the structural direction: slide-contained widgets remain normal workspace widget
  instances rendered by the shared workspace host.
- ADR 055 narrows that model: only the slide `body` is a generic widget host. `Header` and
  `footer` are slide-owned bands, and `left`/`right` are no longer generic slide regions.
- The slide widget props now own:
  - header/footer enablement
  - header/footer heights
  - header/footer slot content
- The slide widget props should not grow back into a second widget store.
- Header/footer slot content is intentionally constrained in the first implementation to:
  - `text`
  - `image`
- Empty header/footer slots render compact edit-only `Add element` placeholders on the slide
  surface. Presentation/view mode should not expose slot labels or placeholder chrome.
- Saved-widget import/export still preserves `slidePlacement`, but normal slide-hosted widgets
  should only persist `slidePlacement.region = "body"` after migration.
- Existing embedded slide widgets are migrated through `extractLegacyWorkspaceSlideChildren(...)`
  in `slide-model.ts` and promoted into normal workspace widget instances with slide placement
  metadata.
- Existing persisted non-body slide placements are migrated into `body` during workspace
  normalization. The migration prioritizes preserving widget instances and bindings over preserving
  the exact old multi-region layout.
- Duplicating a slide from the workspace canvas must also duplicate every slide-contained widget
  that references that slide id, including nested row children and any internal bindings among the
  duplicated slide descendants.
- Existing root-canvas widgets can be dragged directly into the visible slide body during workspace
  edit mode, and slide-contained widgets can also be dragged back out to the root canvas or into a
  different slide body. Those transfers rewrite `slidePlacement` and move the widget between layout
  hosts without duplicating the widget.
- The slide surface itself does not expose inline `Add widget` buttons anymore. Widget insertion is
  expected to happen naturally by dragging normal workspace widgets into the slide body.
- At the root workspace canvas, the slide behaves like a structural full-width widget. It stays
  anchored at `x = 0`, spans the full canvas width, and is not horizontally resizable.
- Widgets placed inside a slide must be rendered through the normal workspace widget host, not a
  private nested widget renderer. The current shared renderer lives in
  `src/features/dashboards/WorkspaceCanvasWidgetHost.tsx`, while the slide subgrid host only owns
  body-stage layout.
- The slide body is a bounded subgrid with a fixed logical row height. It relies on the scaled
  logical slide canvas instead of per-surface row-height drift, so slide composition stays stable
  between edit mode and slideshow mode.
- The slide surface now renders from one fixed logical 16:9 canvas that is uniformly scaled to fit
  the editor and slideshow surfaces. Keep authoring/runtime visual tweaks compatible with that
  scale-first model so slide composition does not drift between edit mode and presentation mode.
- The same `WorkspaceSlideSurface` contract is also reused by Slide Studio print export. Print mode
  switches the surface into `frameMode="print"` so the deck can drop editor/presentation frame
  chrome without introducing a second slide layout path.
- Presentation-oriented callers can opt into a tighter frame fit so slideshow viewports below the
  desktop breakpoint maximize the slide before introducing extra stage padding.
- Region separators are visible while editing and transparent in view mode so the slide reads as a
  cleaner presentation stage.
- Keep `USAGE_GUIDANCE.md` aligned with the body-only widget-hosting contract and the header/footer
  slot authoring model.
