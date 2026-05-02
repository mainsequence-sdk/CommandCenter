# ADR 052: Slide Studio Slideshow Projection Mode

- Status: Accepted
- Date: 2026-05-02
- Owners: Workspaces frontend

## Context

`Slide Studio` currently uses the shared workspace canvas for authoring. That is correct for edit
mode, but it is not enough for presentation.

The authoring canvas has different goals from a slideshow:

- authoring needs several slides visible on one canvas
- authoring needs grid controls, selection, and editing affordances
- presentation needs one slide per screen
- presentation needs chrome reduction and clear navigation

Reusing the normal workspace canvas directly for presentation would keep too much editor behavior in
the runtime surface and would not guarantee the core slideshow rule:

- one visible slide per viewport

The current kiosk mode is also not sufficient on its own. Kiosk mode hides shell chrome, but it
does not change the root workspace composition model into a slideshow model.

## Decision

`Slide Studio` gets a dedicated **slideshow projection mode** that is available only for
`slide-studio` workspaces.

This mode is:

- built on the same persisted workspace document
- read-only at presentation time
- separate from the normal workspace authoring canvas

The slideshow mode does **not** change how slides are authored.

It does **not** replace the existing workspace editor.

It does **not** change the base `Workspaces` surface.

Instead, it projects the existing top-level `workspace-slide` widgets into a presentation runtime
where exactly one slide is shown per screen.

## Core Rules

1. Slideshow mode applies only to workspaces with `type: "slide-studio"`.
2. Only top-level `workspace-slide` widgets participate in slideshow sequencing.
3. One slide is rendered per viewport at a time.
4. Slide ordering comes from the root workspace layout order.
5. The slideshow runtime reuses the existing slide widget rendering contract rather than inventing a
   second slide visual model.
6. Slideshow mode is a route or view-mode projection, not a second persisted workspace document.
7. The base `Workspaces` surface must not gain this slideshow behavior.

## Projection Model

The runtime hierarchy is:

```text
Slide Studio Workspace
  -> ordered top-level workspace-slide widgets
    -> one active slide selected by slideshow state
      -> one full-screen presentation viewport
        -> slide regions
          -> normal workspace widgets already assigned to that slide
```

The important separation is:

- the authoring canvas is many-slides-on-one-canvas
- the slideshow projection is one-slide-per-screen

These are two views over the same workspace content, not two different authoring systems.

## Navigation Rules

Slideshow mode must support:

- next slide
- previous slide
- direct slide selection by route state
- exit back to the editor

At minimum the first implementation should support:

- left/right arrow keys
- page up / page down
- space / shift+space
- an explicit exit action

## Chrome Rules

Slideshow mode should behave like kiosk in that application chrome is minimized, but it still needs
minimal presentation controls.

That means:

- no normal workspace editor toolbar
- no normal widget settings/actions chrome
- minimal slideshow overlay only
- slide counter and exit affordance allowed

The slideshow overlay should be presentation-specific, not the generic workspace toolbar.

## Routing Rules

The slideshow should be route-driven, for example through a dedicated `mode=slideshow` or an
equivalent Slide Studio-specific projection state.

It should not overload existing workspace editor views such as:

- `dashboard`
- `graph`
- `settings`
- `widget-settings`

The projection state belongs to Slide Studio, not to the generic workspace editor contract.

## Consequences

### Positive

- Slide Studio gets a true presentation runtime without corrupting the editor canvas.
- The same workspace document can be authored and presented without duplication.
- One-slide-per-screen behavior becomes explicit and reliable.
- Base `Workspaces` remains unaffected.

### Tradeoffs

- Slide Studio now has two runtime surfaces:
  - authoring
  - slideshow projection
- navigation state has to be managed separately from normal editor state
- slideshow chrome and keyboard handling become Slide Studio-specific concerns

## Rejected Alternatives

### Reuse generic kiosk mode directly on the editor canvas

Rejected because kiosk mode alone hides shell chrome, but it does not convert the root workspace
canvas into a one-slide-per-screen presentation runtime.

### Present all slides on one long scroll surface

Rejected because that is a document-scroll model, not a slideshow model.

### Make slideshow a base Workspaces behavior

Rejected because slideshow is a Slide Studio-specific projection concern and should not modify the
generic workspace surface.

## Implementation Tasks

- [x] Add a Slide Studio-only slideshow route or projection mode.
- [x] Keep slideshow mode available only for `type: "slide-studio"` workspaces.
- [x] Build a dedicated slideshow surface component that loads the selected workspace through the
      shared workspace studio hook.
- [x] Collect only top-level `workspace-slide` widgets for slideshow sequencing.
- [x] Sort slides by root workspace layout order so slideshow order matches the authored deck.
- [x] Render exactly one slide per viewport at a time.
- [x] Reuse the existing slide rendering contract for the active slide instead of inventing a new
      slide visual model.
- [x] Hide generic editor chrome and show only minimal slideshow overlay controls.
- [x] Add slideshow navigation controls for keyboard next/previous and explicit exit.
- [x] Add a Slide Studio `Present` action that opens the slideshow projection from the editor.
- [x] Keep slideshow mode read-only unless a future ADR explicitly adds presenter editing behavior.
- [x] Keep base `Workspaces` unchanged.

## Backend Contract Impact

No backend contract change is required for the first implementation if slideshow state remains
route-driven and non-persisted.

If a future implementation wants persisted slideshow options such as:

- default starting slide
- transitions
- presenter notes visibility
- slide-specific runtime preferences

that would become a separate persisted workspace contract decision and should be handled by a new
ADR.

## Success Criteria

The implementation is correct when all of the following are true:

1. Opening slideshow mode from Slide Studio shows one slide per screen.
2. Slideshow order matches the authored top-level slide order.
3. Widgets inside each slide render exactly as part of that slide, not as a separate root-canvas
   layout.
4. Base `Workspaces` behavior is unchanged.
5. Exiting slideshow returns the user to the normal Slide Studio editor.
