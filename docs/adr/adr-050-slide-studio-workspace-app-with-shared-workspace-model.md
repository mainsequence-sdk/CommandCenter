# ADR 050: Slide Studio as a Workspace App with Shared Workspace Model

- Status: Accepted
- Date: 2026-05-01
- Related:
  - [ADR: Use React Grid Layout v2 API in Workspace Studio](./adr-rgl-v2-workspace-studio.md)
  - [ADR: Headless Workspace Widget Settings Runtime](./adr-headless-workspace-settings-runtime.md)
  - [ADR: Extension-Contributed Shell Settings Menus](./adr-extension-contributed-shell-settings-menus.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)

## Context

We want to add a presentation-oriented authoring surface built from existing widgets, but we do not
want to turn slides into widgets or pollute the base workspace canvas with slide-specific behavior.

Several earlier shapes were considered:

- a `Slide` widget that owns nested widgets
- a completely separate extension product with its own storage model
- a base workspace layout mode such as `layoutKind: "slides"`
- slide membership stored directly on generic widget presentation

The product boundary we actually want is narrower:

- `Slide Studio` belongs to the workspace app family
- it is a different app or surface from the existing workspace canvas
- it should reuse the backend workspace model
- it should import and reuse existing workspace infrastructure rather than modifying the actual
  `Workspaces` app
- slides are first-class authoring primitives of that app
- slides are not widgets
- the existing generic workspace canvas should stay clean and independently maintainable

That means Slide Studio should sit beside the existing workspace canvas as another workspace-backed
app, while slide-specific structure remains app-owned inside the shared workspace resource.

## Decision

We will build `Slide Studio` as a workspace-backed app that belongs to the workspace extension
family and reuses the existing backend workspace model.

Slides will be first-class entities of that app. They will not be represented as widgets, and they
will not be added as a generic capability of the base workspace canvas.

The dependency direction is one-way:

- `Slide Studio` imports and reuses workspace infrastructure
- the actual `Workspaces` app does not gain slide behavior, slide-aware rendering, or Slide
  Studio-specific authoring rules
- `Workspaces` must not import from `Slide Studio`

The shared backend workspace resource remains the outer persistence envelope for:

- workspace identity
- ownership and permissions
- labels, favorites, and lifecycle
- save/load flows
- sharing and backend integration

Slide-specific structure will live in an app-owned, namespaced payload inside that shared workspace
model rather than in separate top-level slide storage and rather than in the generic
`DashboardDefinition` contract used by the standard workspace canvas.

## Goals

- Keep the base workspace canvas independent of slide authoring semantics.
- Make slides first-class authoring objects of a dedicated workspace app.
- Reuse the existing backend workspace model instead of creating a separate slide-deck backend
  entity.
- Reuse existing widget definitions and rendering contracts without turning slides into widgets.
- Keep slide-specific content isolated enough that the generic workspace app does not need to know
  how slides work.
- Make the implementation dependency direction explicit: Slide Studio imports from Workspaces and
  shared workspace modules, while Workspaces remains unchanged.

## Non-Goals

- Making `Slide` a widget type.
- Creating a completely separate product/storage system outside the workspace backend model.
- Adding deck navigation and slide regions to the base workspace canvas by default.
- Modifying the actual `Workspaces` app so it becomes slide-aware.
- Supporting one widget instance on multiple slides in v1.
- Supporting freeform nested canvases inside slide regions in v1.
- Forcing the base `DashboardDefinition` used by the generic workspace canvas to own slide
  semantics directly.

## Architecture

### 1. App boundary

`Slide Studio` is a different workspace app or surface, not a completely separate extension
	product and not a widget.

It should live in the workspace extension family and participate in the same workspace-oriented
navigation model, but it owns a presentation-first authoring experience distinct from the generic
workspace canvas.

This gives us:

- one shared workspace platform
- more than one workspace-backed authoring surface
- a clean separation between generic dashboard composition and presentation composition

Implementation rule:

- `Slide Studio` imports from existing workspace infrastructure
- the existing `Workspaces` app remains behaviorally unchanged
- code ownership flows from shared workspace modules into Slide Studio, never from Slide Studio back
  into Workspaces

### 2. Shared backend workspace model

Slide Studio must reuse the backend workspace model rather than creating an unrelated deck model at
the API boundary.

That means the same backend workspace record should continue to own:

- ids
- permissions
- sharing
- metadata
- persistence lifecycle

However, reusing the workspace model does **not** mean every slide field belongs in the generic
dashboard schema used by the base workspace canvas.

The expected shape is:

- shared workspace envelope stays common
- Slide Studio stores its app-specific content inside an optional namespaced app payload within that
  workspace
- the generic workspace dashboard payload consumed by `Workspaces` stays unchanged

The exact field name can be chosen during implementation, but it should behave like:

```ts
interface WorkspaceRecord {
  // existing shared workspace fields
  appPayloads?: {
    slideStudio?: SlideStudioWorkspaceContent;
  };
}
```

This keeps Slide Studio on the shared backend model without making generic workspace readers
understand slide structure.

### 3. Slide-first app payload

Slide Studio should own a presentation payload similar to:

```ts
type SlideRegion = "header" | "left" | "body" | "right" | "footer";

interface SlideWidgetPlacement {
  widgetInstanceId: string;
  region: SlideRegion;
  order: number;
}

interface SlideDefinition {
  id: string;
  title: string;
  headerHeightPct: number;
  footerHeightPct: number;
  leftWidthPct: number;
  rightWidthPct: number;
  widgets: SlideWidgetPlacement[];
}

interface SlideStudioWorkspaceContent {
  version: 1;
  slides: SlideDefinition[];
  widgets: DashboardWidgetInstance[];
}
```

Important characteristics:

- slides own presentation structure
- widgets remain normal widget instances
- placement is slide-owned, not widget-owned
- the payload is app-owned, even though the outer workspace record is shared

### 4. Ownership invariant

V1 enforces one hard rule:

- one widget instance belongs to exactly one slide

Implications:

- one `widgetInstanceId` may appear at most once across the slide payload
- a widget cannot be placed on multiple slides simultaneously
- if the same configuration is needed on multiple slides, authors duplicate the widget instance

This keeps ownership, selection, ordering, and runtime semantics unambiguous.

### 5. Rendering model

Slide Studio renders one active slide at a time.

Each slide is a structured presentation frame with these regions:

- `header`
- `left`
- `body`
- `right`
- `footer`

The slide shell uses percentage-based layout rules:

- `headerHeightPct`
- `footerHeightPct`
- `leftWidthPct`
- `rightWidthPct`

The remaining center area becomes the main body region. Region sizing must stay relative to the
slide viewport so the presentation adjusts to the app surface size.

V1 rendering behavior:

- widgets inside one region render in explicit `order`
- regions stack their widgets vertically
- no freeform per-region drag canvas
- no slide-inside-slide nesting

### 6. Integration with the widget platform

Slide Studio should reuse the widget platform and existing workspace infrastructure where the
abstraction is already shared:

- widget registry and definition lookup
- widget component mounting
- widget settings shells
- widget bindings and runtime execution helpers, if the slide app needs them

Slide Studio should not require generic widgets or the actual `Workspaces` app to understand
slides.

The direction is:

- widgets stay generic
- Slide Studio is the host that places widget instances into presentation regions

### 7. No modifications to the actual Workspaces app

The existing `Workspaces` app and its generic workspace canvas should not need to render, edit, or
understand slides in order to remain correct.

This ADR explicitly requires that Slide Studio be implemented by importing from existing workspace
infrastructure rather than by modifying the behavior or contract of the actual Workspaces app.

That means:

- no `Slide` widget in the generic widget catalog just to make slide authoring work
- no base canvas requirement to understand slide regions
- no generic widget presentation flag such as `placementMode: "slide"`
- no Slide Studio-driven behavior changes in the existing Workspaces canvas

Slide semantics are app-owned, not generic-canvas-owned.

### 8. Validation rules

Slide Studio should validate at least the following before save:

- every referenced `widgetInstanceId` exists in the app payload widget collection
- no widget instance appears on more than one slide
- no widget instance appears multiple times on the same slide
- `headerHeightPct + footerHeightPct` leaves a positive body band
- `leftWidthPct + rightWidthPct` leaves a positive body column
- region order is deterministic

## Consequences

### Positive

- Slide Studio reuses the backend workspace model, permissions, and lifecycle.
- The actual `Workspaces` app stays focused on generic dashboard authoring and remains unchanged.
- Slides become true first-class presentation objects instead of a widget hack.
- Widget reuse stays available through the shared widget platform.
- If slide authoring changes later, it can evolve within its app payload rather than forcing the
  base workspace canvas to adopt slide semantics.

### Negative

- The shared workspace resource now contains app-specific payloads that must be versioned
  carefully.
- Slide Studio still needs its own host orchestration even though it shares the workspace backend
  envelope.
- If Slide Studio needs richer graph/runtime reuse, some generic helpers may need to be extracted
  from current workspace code.

## Rejected Alternatives

### 1. `Slide` as a widget

Rejected because it makes presentation structure look like ordinary widget content and either:

- forces nested widget-runtime semantics into one widget
- or forces that widget to re-parent top-level siblings, which is really host behavior

This blurs the boundary between composition host and composable component.

### 2. Completely separate extension-owned storage model

Rejected because Slide Studio should share the existing backend workspace model, workspace
permissions, and workspace lifecycle rather than introducing a second deck-specific backend entity.

The app should be separate at the authoring-surface level, not at the outer persistence-envelope
level.

### 3. Base workspace `layoutKind: "slides"`

Rejected because it couples the generic workspace canvas to one presentation-specific authoring
mode.

We want a separate workspace app, not a mandatory slide-aware base canvas.

### 4. Widget-owned slide placement

Rejected because it pushes slide awareness into generic widget presentation and makes every widget
instance carry presentation-product-specific placement state.

Placement should be slide-owned inside the Slide Studio payload, not widget-owned.

## Follow-Up Guidance

- Implement Slide Studio as a workspace-backed app or surface inside the workspace extension family.
- Reuse the shared backend workspace resource and persist Slide Studio state in an app-owned payload
  namespace within that model.
- Keep generic workspace canvas contracts independent from slide-specific authoring rules.
- Prefer importing and reusing existing workspace infrastructure over modifying the actual
  `Workspaces` app.
- `Workspaces` must remain a dependency of Slide Studio; Slide Studio must not become a dependency
  of `Workspaces`.
- If interoperability between the generic workspace canvas and Slide Studio becomes important later,
  define it explicitly as an import/export or translation concern rather than by leaking slide
  semantics into generic widget presentation.
