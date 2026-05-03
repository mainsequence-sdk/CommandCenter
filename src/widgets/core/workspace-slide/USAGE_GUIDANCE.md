## buildPurpose

Slide-style structural container with one bounded `body` widget stage plus optional slide-owned
`header` and `footer` bands.

## whenToUse

- Use when one workspace canvas should contain one or more presentation slides.
- Use when normal workspace widgets should be visually constrained inside one fixed-aspect slide
  stage instead of floating freely across the whole canvas.
- Use when the slide needs simple slide-owned header/footer content such as titles, branding, or
  footer notes without turning those bands into separate widget canvases.

## whenNotToUse

- Do not use when a simple row grouping is enough; use `Row` for lightweight section grouping.
- Do not use when you need arbitrary widget placement in side rails or header/footer bands; this
  slide model only allows generic widgets in the `body`.
- Do not use when the slide itself should own nested widget snapshots.

## authoringSteps

- Add a `Slide` widget to the normal workspace canvas.
- Resize the slide height on the root canvas until the overall slide frame has the desired size.
- Add or move normal workspace widgets into the slide `body`.
- Enable `header` and/or `footer` from slide settings only when the slide needs extra
  slide-controlled content.
- For each enabled band, configure the `left`, `middle`, and `right` slots from settings.
- In the first implementation, each slot may contain either:
  - `text`
  - `image`
- Resize enabled header/footer bands by dragging the visible horizontal delimiters on canvas.
- Drag slide-contained widgets out onto the root canvas to extract them from the slide, or drop
  them into another slide body to reparent them without duplication.
- Duplicating the slide duplicates the widgets already placed inside the slide body as well.

## blockingRequirements

- The slide widget must exist on the workspace canvas before widgets can be placed into the slide
  body.

## commonPitfalls

- The slide is a structural boundary, not a widget-owned sub-canvas.
- Only the `body` accepts arbitrary workspace widgets.
- `Header` and `footer` are slide-owned bands, not generic widget regions.
- `Header` and `footer` each expose three slots: `left`, `middle`, and `right`.
- Header/footer slot content is currently limited to `text` and `image`.
- Slide-contained widgets must use the same renderer path and chrome as ordinary workspace widgets.
- The slide surface does not expose inline `Add widget` buttons; adding slide content is a drag
  action from the workspace canvas.
