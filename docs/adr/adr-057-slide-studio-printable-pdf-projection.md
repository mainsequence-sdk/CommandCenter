# ADR 057: Slide Studio Printable PDF Projection

- Status: Accepted
- Date: 2026-05-05
- Owners: Workspaces frontend
- Related:
  - [ADR 050: Workspace Slide as Structural Container](./adr-050-workspace-slide-as-structural-container.md)
  - [ADR 052: Slide Studio Slideshow Projection Mode](./adr-052-slide-studio-slideshow-projection-mode.md)
  - [ADR 053: Public View For Workspace And Slide Studio](./adr-053-public-view-for-workspace-and-slide-studio.md)
  - [ADR 055: Simplify Slide To Body-Only Widget Hosting](./adr-055-simplify-slide-to-body-only-widget-hosting.md)

## Context

`slide-studio` currently supports authoring and slideshow presentation, but it does not provide a
print-oriented export path.

Users want an `Export PDF` action that produces a printable deck where:

- each top-level slide occupies a full page
- the printed layout matches the authored slide composition as closely as possible
- the result can be saved as PDF through the browser print flow

The current system already has the important building blocks:

- slide ordering is implicit from top-level `workspace-slide` widget order
- slide rendering already reuses one fixed logical `16:9` canvas
- slideshow projection already renders one top-level slide per screen
- hidden/sidebar dependency widgets can remain mounted offscreen while visible slides render

The missing piece is a dedicated print projection.

The wrong approach would be to introduce a second export renderer or screenshot stitching pipeline.
That would create drift between:

- editor mode
- slideshow mode
- print/export mode

We should keep one slide rendering contract and add a new projection mode around it.

## Decision

Slide Studio PDF export will be implemented as a **print projection mode** of `slide-studio`, not as
a separate PDF generation engine.

The first version will:

1. add a workspace-level `Export PDF` action for `slide-studio`
2. open a dedicated print projection route or mode
3. render all top-level slides in deck order
4. place exactly one slide on each print page
5. use the browser print pipeline (`window.print()`) so the user can save as PDF

This is a frontend-only projection and must not require workspace publishing or a backend export
service.

## Design

### 1. Add a print projection mode

`slide-studio` should gain a route-driven print mode, for example:

- `?mode=print`

This mode is specific to `slide-studio`. It should not be exposed for normal workspaces in the first
version.

### 2. Reuse the existing slide renderer

The print projection must reuse the same slide surface contract as editor/slideshow mode:

- `WorkspaceSlideSurface`

This is the main anti-drift rule.

The print view may change the surrounding stage/chrome and scaling behavior, but it must not create
a second slide layout algorithm.

### 3. Render all top-level slides

Unlike slideshow mode, print mode should render the entire deck in one pass.

The print renderer should:

- collect all top-level `workspace-slide` widgets
- preserve current deck ordering
- render one print page container per slide

Slide-contained child widgets remain rendered through the same normal workspace widget path already
used by slideshow mode.

### 4. One slide per page

Each top-level slide should map to exactly one printed page.

Print CSS should enforce page separation with rules such as:

- `break-after: page`
- `page-break-after: always`

The printed page should have no extra deck chrome or navigation controls.

### 5. Use browser print instead of client-side PDF assembly

The first version should use:

- HTML/CSS rendering
- `window.print()`

and let the browser/system print dialog handle PDF creation.

This avoids:

- screenshot rasterization
- canvas stitching
- a second PDF-specific rendering stack
- browser-specific image capture bugs

### 6. Prefer a presentation page size

The print projection should target a `16:9` page shape first so the slide canvas does not distort.

Preferred print CSS:

```css
@page {
  size: 13.333in 7.5in;
  margin: 0;
}
```

If browser support forces a fallback, landscape zero-margin output is acceptable, but the logical
slide aspect ratio still remains the source of truth.

### 7. Remove non-print chrome

Print mode must not render:

- workspace editor chrome
- slideshow next/previous controls
- public top navigation shell
- hover hints
- drag handles
- edit affordances

The output should read as a clean deck, not as an app screenshot.

### 8. Keep dependency hydration active

Print mode still needs the same data/runtime discipline as slideshow mode.

Visible slide widgets may depend on hidden/sidebar-only widgets. Therefore:

- hidden dependency widgets should still hydrate offscreen
- print mode should not simplify itself into a static DOM-only projection that skips widget runtime

### 9. Add a print-readiness gate

Print should not trigger on the first paint.

The print mode should wait for:

- initial dashboard hydration
- at least one stable render pass

Then it can:

- automatically invoke `window.print()`
- and optionally expose a manual `Print again` action if the browser blocks or dismisses the dialog

### 10. Export action belongs to workspace-level actions

The trigger should be a workspace-level `Export PDF` action for `slide-studio`.

It should not be:

- a widget action
- a slide widget action
- a public-view action

This is a deck-level operation.

## Non-Goals

The first version will not:

- generate PDFs in JavaScript without the browser print pipeline
- support print export for normal workspaces
- generate PPT/PPTX
- depend on public link publishing
- persist per-workspace print presets
- snapshot slides into raster images before export

## Consequences

### Positive

- Print output stays aligned with the same slide renderer used in authoring/presentation.
- The implementation remains frontend-only.
- Browser-native PDF save flows do most of the heavy lifting.
- The deck stays vector/text-friendly where widgets already render that way.

### Negative

- Browser print behavior can still vary across environments.
- Custom `@page` sizing support is not perfectly uniform.
- Some widgets may need print-specific verification if they depend on late canvas sizing.

## Rejected Alternatives

### 1. Screenshot-based PDF export

Rejected because it introduces rendering drift, rasterization loss, and another export pipeline to
maintain.

### 2. Dedicated backend PDF service

Rejected for the first version because the existing frontend slide renderer already owns the visual
contract.

### 3. Reuse slideshow mode directly and hide controls with CSS only

Rejected because slideshow and print are different projections with different behavior:

- slideshow is interactive and single-slide
- print is static and whole-deck

### 4. Print one very long page and rely on automatic pagination

Rejected because slide boundaries are explicit and must map to explicit print pages.

## Storage Contract Assessment

This ADR should be implemented without changing persisted storage.

No change is required to:

- `DashboardDefinition`
- `DashboardWidgetInstance`
- slide widget props
- widget runtime state persistence
- workspace publishing/public-link contracts

If a future version adds persisted export presets, paper size options, or branded print themes,
that should be treated as a separate storage-contract ADR.

## Implementation Tasks

- [x] Add a `slide-studio` print projection mode in the route/runtime layer.
- [x] Add a workspace-level `Export PDF` action visible only for `slide-studio`.
- [x] Build a print-only deck renderer that iterates all top-level slides in deck order.
- [x] Reuse `WorkspaceSlideSurface` for print rendering instead of building a second slide layout
      path.
- [x] Add print CSS so each slide gets exactly one page.
- [x] Remove slideshow/public/editor chrome from print projection mode.
- [x] Preserve hidden dependency widget hydration for print mode.
- [x] Add a print-readiness gate before invoking `window.print()`.
- [x] Set a sensible document title so browser PDF save defaults use the deck title.
- [x] Update Slide Studio docs in `src/features/dashboards/README.md`.
- [x] Update slide widget docs in `src/widgets/core/workspace-slide/README.md` if print mode adds
      authoring expectations.
- [ ] Verify output with chart-heavy and text-heavy decks in at least one Chromium browser.

## Success Criteria

The implementation is correct when all of the following are true:

1. `Export PDF` is available for `slide-studio`.
2. Opening export mode renders the whole deck, not just the active slideshow slide.
3. Each top-level slide prints as one page.
4. Printed slides preserve the same composition contract as slideshow mode.
5. No navigation/editor/public chrome appears in the printed output.
6. The feature works through the normal browser print/save-as-PDF flow without backend support.
