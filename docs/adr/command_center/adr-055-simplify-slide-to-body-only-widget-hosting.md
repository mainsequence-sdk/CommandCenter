# ADR 055: Simplify Slide To Body-Only Widget Hosting

- Status: Accepted
- Date: 2026-05-03
- Owners: Workspaces frontend

## Context

ADR 050 established the correct high-level direction for `workspace-slide`:

- `Slide` is structural
- slide-contained content remains normal workspace widgets
- slide/runtime rendering should reuse the shared workspace widget host

That direction fixed the earlier nested-widget-store mistake, but it still left the slide model too
general.

Today the slide exposes five generic widget-hosting regions:

- `header`
- `left`
- `body`
- `right`
- `footer`

That flexibility looks attractive, but it is carrying too much complexity for the value it gives:

1. every optional band becomes a full widget drop target
2. every band participates in drag and cross-host reparenting semantics
3. every band must preserve bounded subgrid behavior
4. slide settings, region dividers, and slideshow rendering all have to honor five generic layout
   surfaces instead of one primary stage
5. the slide authoring model drifts away from the real use case, which is a presentation stage
   with optional slide-owned auxiliary structure, not five independent dashboard canvases

The result is that `Slide` is structurally cleaner than the original embedded-snapshot design, but
it is still heavier than it should be.

The main stage of a slide is the body. The other bands are better treated as reserved structural
areas for narrowly defined slide-owned capabilities such as:

- title or eyebrow text
- footer text
- branding
- navigation affordances
- other future slide-specific presentation metadata

They should not remain general widget drop zones.

There is also no strong reason to keep `left` and `right` as first-class generic layout regions
inside the slide model. They multiply layout combinations and drag targets, but they do not align
with the simpler presentation model we actually want.

## Decision

`workspace-slide` will be simplified so that:

1. `body` is the **only** generic widget-hosting region.
2. `left` and `right` are removed as generic slide layout regions.
3. `header` and `footer` remain, but they are **not** widget regions.
4. `header` and `footer` are each divided into three slide-owned slots:
   - `left`
   - `middle`
   - `right`
5. Each slot is controlled by the slide widget itself, not by generic workspace widget placement.
6. In the first implementation, the only supported slot content types are:
   - `text`
   - `image`
7. Normal workspace widgets assigned to a slide may only persist `slidePlacement.region = "body"`
   after migration.

This ADR narrows ADR 050 rather than replacing it:

- `Slide` remains a structural container
- slide-contained widgets remain normal workspace widgets
- the shared workspace renderer remains the only widget renderer

What changes is the scope of the slide subgrid:

- from **five generic widget-hosting regions**
- to **one generic widget-hosting region (`body`)**

And what changes in the auxiliary structure is:

- from **free-form header/footer/left/right widget regions**
- to **slide-owned header/footer bands with three controlled slots each**

## Why This Is Better

### Simpler mental model

Users should understand a slide as:

- one main content stage
- optional slide-owned framing bands
- optional header/footer slots for simple presentational content

not as a five-panel dashboard layout.

### Less drag and host-transfer complexity

If only `body` accepts generic widgets:

- fewer drop targets exist
- fewer cross-host transfer cases need to be valid
- fewer region-local layout states need to be preserved

### Better slideshow consistency

Slide presentation mode should optimize one main aspect-ratio-constrained stage. Auxiliary bands
should behave like presentation chrome, not like extra widget canvases that compete with the body
for layout and interaction rules.

### Cleaner future slide features

Dedicated slide capabilities such as title, footer, branding, or presentation controls can be
added without also promising that every band must support arbitrary widget composition forever.

The three-slot header/footer model also keeps future capabilities honest: if a feature belongs to
the slide shell, it should be expressed as slide-owned slot content, not smuggled in through a
generic widget-hosting escape hatch.

## Consequences

### Good

- Slide authoring becomes easier to reason about.
- The bounded slide subgrid becomes smaller and more stable.
- Slideshow rendering and editor rendering become easier to keep visually aligned.
- Drag behavior becomes easier to maintain.
- Future slide-specific presentation features can use reserved bands without competing with generic
  widget hosting.

### Tradeoffs

- Existing workspaces that placed widgets in `header`, `left`, `right`, or `footer` need
  migration.
- Some multi-band compositions that were technically possible today will no longer be valid as
  arbitrary widget layouts.
- Header/footer content is intentionally constrained at first to simple text and image content.
- If we later need complex non-body composition, that should come from a dedicated slide-owned
  feature model, not by reopening all regions as generic widget hosts.

## Migration Direction

When implemented, saved workspaces should migrate as follows:

1. Any slide child already in `body` remains unchanged.
2. Any slide child in `header`, `left`, `right`, or `footer` must be remapped.

Preferred migration behavior:

- move those widgets into the slide `body`
- preserve their widget instances and bindings
- preserve as much relative ordering as possible
- clear the old non-body `slidePlacement.region` values

Header/footer slot content is not derived automatically from migrated widget instances in the first
pass. Migration should prioritize preserving widget content in `body` rather than trying to infer
whether an old header/footer widget should become slide-owned text or image content.

If preserving exact spatial relationships is not feasible, the migration should still favor a safe,
deterministic placement into `body` rather than preserving a more complex invalid model.

## Rejected Alternatives

### 1. Keep all five regions as generic widget hosts

Rejected because it preserves the exact complexity we now want to remove.

### 2. Remove `header`, `left`, `right`, and `footer` entirely

Rejected because the slide still benefits from reserved structural bands for slide-owned
presentation features, especially a simple header/footer composition model.

### 3. Keep auxiliary regions widget-capable, but only for a widget allowlist

Rejected because it still keeps the wrong generic-host abstraction alive. If those bands are meant
for specialized functionality, that should be expressed explicitly in the slide model rather than
through special-cased widget allowances.

### 4. Keep `left` and `right` as structural regions, but not widget regions

Rejected because they still complicate the slide shell and stage proportions without a clear
presentation-specific capability model. Header and footer slots are enough for the simpler slide
contract we want now.

## Implementation Tasks

- [x] Narrow the slide authoring contract so only `body` is a generic widget drop target.
- [x] Remove generic widget-host rendering for `header`, `left`, `right`, and `footer`.
- [x] Remove `left` and `right` as first-class slide layout regions from the slide shell model.
- [x] Remove cross-host transfer targets for non-body slide regions.
- [x] Simplify `WorkspaceSlideWidgetProps` and slide settings so auxiliary bands are modeled as
      reserved structure, not generic widget containers.
- [x] Add explicit slide-owned `header` and `footer` slot models with `left`, `middle`, and
      `right` sections.
- [x] Add first-pass slot content types for `text` and `image` only.
- [x] Define the slide-owned prop contract for header/footer slot content instead of routing that
      content through generic widget instances.
- [x] Add deterministic workspace migration from non-body slide placements into `body`.
- [x] Update slideshow/editor rendering so auxiliary bands behave like slide-owned presentation
      chrome instead of widget host regions.
- [x] Update the widget and workspace READMEs after implementation.
- [x] Reconcile ADR 050 wording once the simplified model lands.

## Backend Contract Impact

This is a persisted workspace contract change when implemented.

Today `slidePlacement.region` may contain:

- `header`
- `left`
- `body`
- `right`
- `footer`

After this ADR is implemented, normal workspace widgets should only persist:

- `slidePlacement.region = "body"`

That means any backend or saved-widget serializer/deserializer that reads or writes workspace
widget instances must tolerate the migration window and preserve migrated slide placement data
correctly.

This ADR also implies an additive slide-widget prop contract change when implemented:

- the slide widget will need explicit header/footer slot content props
- those slot props are slide-owned structured content, not nested widget instances

If backend validation is strict on widget props, it must tolerate that new slide-widget prop shape.

## Success Criteria

The simplification is successful when all of the following are true:

1. Only the slide `body` accepts arbitrary workspace widgets.
2. `left` and `right` no longer exist as generic slide widget regions.
3. `header` and `footer` are no longer generic widget drop targets.
4. `header` and `footer` each expose three slide-owned slots: `left`, `middle`, and `right`.
5. The first implementation supports only `text` and `image` slot content.
6. Slide authoring and slideshow rendering both optimize around one primary content stage.
7. Cross-host transfer logic no longer needs to reason about non-body destination regions.
8. Existing saved workspaces with non-body slide children migrate deterministically into a valid
   body-only model.
