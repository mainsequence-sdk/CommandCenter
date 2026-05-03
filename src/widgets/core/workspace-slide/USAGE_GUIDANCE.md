## buildPurpose

Slide-style structural container for composing a bounded `header / left / body / right / footer`
layout directly inside a normal workspace canvas.

## whenToUse

- Use when one workspace canvas should contain one or more presentation slides.
- Use when normal workspace widgets should be visually constrained inside slide regions instead of
  floating freely across the whole canvas.
- Use when the initial authoring experience should feel like placing a presentation page on the
  canvas rather than dropping a standard dashboard card.
- Use when the slide should span the full root canvas width and behave like a structural layout
  widget.

## whenNotToUse

- Do not use when a simple row grouping is enough; use `Row` for lightweight section grouping.
- Do not use when you want the slide itself to own nested widget snapshots.

## authoringSteps

- Add a `Slide` widget to the normal workspace canvas.
- Start from the central stage; enable optional `header`, `footer`, `left`, or `right` regions
  from slide settings only when the slide composition needs them.
- Resize the slide height on the root canvas until the overall slide frame has the desired size.
- Resize optional regions by dragging the visible delimiters.
- Add or move normal workspace widgets into the desired slide region.
- You can drag an existing root-canvas widget directly into a visible slide region to move it into
  the slide.
- Drag child widgets from their header and resize them inside their assigned region.
- Drag a slide-contained widget out onto the root canvas to extract it from the slide, or drop it
  into another visible slide region to reparent it without duplicating it.
- Duplicating the slide duplicates the widgets already placed inside that slide as well.
- As a slide region fills up, the slide subgrid shrinks row height inside that region so widgets
  stay inside the slide bounds instead of overflowing below the slide.

## blockingRequirements

- The slide widget must exist on the workspace canvas before widgets can be placed into a slide
  region.

## commonPitfalls

- The slide is a structural boundary, not a widget-owned sub-canvas.
- `Header` and `footer` live only inside the center column; `left` and `right` span the full slide
  height.
- `Left`, `right`, `header`, and `footer` are absent by default.
- Region separators are only visible in edit mode.
- Slide-contained widgets must use the same renderer path and chrome as ordinary workspace widgets.
- Slide-contained widgets do not share root-canvas overflow behavior. Each region is a bounded
  subgrid that compresses vertically to keep widgets inside the slide.
- The slide surface does not expose inline `Add widget` buttons; adding slide content is a drag
  action from the workspace canvas.
