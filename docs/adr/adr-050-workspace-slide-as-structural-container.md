# ADR 050: Workspace Slide as Structural Subgrid

- Status: Accepted
- Date: 2026-05-01
- Owners: Workspaces frontend

> Note: ADR 055 narrows the generic hosting surface further. `Slide` remains structural with a
> separate subgrid host, but the long-term widget-hosting scope is now the `body` stage only.

## Context

The original `workspace-slide` work drifted because it mixed up three different responsibilities:

- widget rendering
- workspace layout hosting
- slide-specific structure

That produced the wrong architecture:

- `Slide` started owning embedded widget snapshots
- slide-contained widgets were rendered through a private nested renderer
- root-canvas widgets and slide-contained widgets drifted in chrome, drag, resize, and edit-mode behavior

That was rejected.

The opposite extreme is also wrong: treating `Slide` as if it were identical to `Row` in every respect.

`Row` is a structural boundary in the root canvas. `Slide` is also structural, but it is more than a row boundary: it creates a constrained **subgrid** for normal workspace widgets.

So the clean model is not:

- one host
- two renderers

and not:

- one host
- one renderer
- no subgrid

The clean model is:

- **two layout hosts**
  - the root workspace canvas host
  - the slide subgrid host
- **one shared widget renderer**
  - the same widget card, header, actions, inline-edit, permission shell, and body rendering contract in both hosts
- **one widget model**
  - slide-contained widgets stay normal `DashboardWidgetInstance` records

This ADR replaces earlier wording that over-emphasized `Slide` being "just like Row" without acknowledging that `Slide` is structurally a subgrid.

## Decision

`workspace-slide` remains a structural widget on the normal `Workspaces` canvas.

It does **not** own child widget snapshots.

It does **not** own a private widget renderer.

It **does** define a subgrid host for widgets assigned to that slide.

The canonical hierarchy is:

```text
Root Workspace Canvas
  -> Slide widget instance
    -> Slide subgrid host
      -> Slide regions
        -> Normal workspace widget instances referenced by slidePlacement
```

## Structural Rules

1. `Slide` is a normal top-level workspace widget.
2. `Slide` owns only structural shell state:
   - optional region enablement
   - divider positions / percentages
   - no widget snapshots
3. Widgets inside a slide remain normal workspace widgets.
4. Slide membership is stored on the widget as persisted placement metadata:
   - `slidePlacement.slideWidgetId`
   - `slidePlacement.region`
5. The root canvas host renders only widgets without `slidePlacement`.
6. The slide subgrid host renders widgets whose `slidePlacement.slideWidgetId` matches that slide.
7. Both hosts must use the same shared widget renderer module.
8. Drag semantics must stay host-local:
   - slide drags from the slide header only
   - slide-contained widgets drag from their own widget headers only
   - root widgets drag in the root host only
9. Optional `header`, `footer`, `left`, and `right` regions stay settings-driven.

## What a Slide Is

A slide is a **subgrid**.

That means:

- the slide surface creates bounded layout regions
- widgets inside those regions still behave like normal workspace widgets
- the slide subgrid host owns region-local grid coordinates and bounds
- the shared widget renderer owns how widgets look and behave inside a card

This separation is important:

- **host** decides where widgets live
- **renderer** decides how widgets render

## What a Slide Is Not

A slide is not:

- a second widget store
- a widget snapshot container
- a separate app surface
- a fake root-level row clone with no subgrid behavior
- a private rendering system for child widgets

## Consequences

### Good

- widgets inside and outside slides share one rendering contract
- slide-specific layout concerns stay in the slide subgrid host
- slide boundaries remain structural and clean
- slide children participate in normal widget settings, bindings, and saved-widget flows because they remain normal workspace widgets

### Tradeoffs

- there are intentionally **two layout hosts**
- cross-host reparenting, such as dragging a root widget into a slide, is a host-transfer feature and must be implemented explicitly
- persisted workspace shape now includes `slidePlacement`, so backend and saved-widget serialization must preserve that metadata

## Rejected Alternatives

### 1. Embedded slide-owned widget snapshots

Rejected because it creates a second widget store and a private widget renderer.

### 2. One root host with no slide subgrid

Rejected because a slide is not only a boundary marker. It is a bounded layout surface with region-local coordinates.

### 3. Separate Slide Studio app or canvas mode

Rejected because the intended UX is still the normal `Workspaces` canvas with structural slide widgets dropped into it.

## Implementation Tasks

- [x] Extract one shared workspace widget renderer module from
      `src/features/dashboards/CustomDashboardStudioPage.tsx` and
      `src/features/dashboards/DashboardCanvas.tsx`.
- [x] Keep two explicit layout hosts:
      - root workspace canvas host
      - slide subgrid host
- [x] Ensure the slide subgrid host owns only region-local layout responsibilities:
      drag, resize, bounds, and region-local coordinates.
- [x] Ensure the shared widget renderer owns only widget rendering responsibilities:
      frame, header, actions, inline-edit gating, permission shell, and widget body rendering.
- [x] Keep `WorkspaceSlideWidgetProps` limited to shell state:
      region enablement and divider positions only.
- [x] Keep `slidePlacement` as persisted metadata on normal workspace widgets.
- [x] Ensure studio mode and runtime mode both use the same shared widget renderer for slide-contained widgets.
- [x] Remove embedded-slide runtime ownership and private rendering paths, while retaining only the one-time legacy migration helper for old saved data.
- [x] Remove any residual slide-specific private renderer code paths.
- [x] Keep normal widget settings, action menu, bindings access, and saved-widget flows working for slide-contained widgets.
- [x] Preserve correct drag ownership:
      - slide drags only from slide header
      - slide-contained widgets drag only from their own widget headers
- [x] Preserve correct resize ownership:
      - slide resizes as a root widget
      - slide-contained widgets resize inside the slide subgrid host
- [x] Keep optional regions settings-driven, not canvas-toggle-driven.
- [x] Support root canvas -> slide region cross-host reparenting for normal workspace widgets.
- [x] Support slide region -> root canvas cross-host reparenting so slide-contained widgets can be
      extracted back onto the main canvas.
- [x] Support slide region -> different slide region cross-host reparenting so slide-contained
      widgets can move across slides and regions without duplication.
- [x] Remove old ADR wording or implementation assumptions that imply `Slide` should have no subgrid host at all.

## Backend Contract Impact

This is a persisted workspace contract change.

Normal workspace widget records now carry slide membership metadata through `slidePlacement`.

Any backend or saved-widget serializer/deserializer that reads or writes workspace widget instances must preserve this field.

## Success Criteria

The implementation is correct when all of the following are true:

1. `Slide` no longer owns child widget snapshots.
2. Slide-contained widgets remain normal workspace widget instances.
3. Root canvas and slide subgrid use the same widget renderer.
4. Slide and child widgets do not fight over drag ownership.
5. Runtime and studio display the same widget chrome and behavior inside and outside slides.
6. The slide code reads as a structural subgrid implementation, not as a nested widget-runtime workaround.
