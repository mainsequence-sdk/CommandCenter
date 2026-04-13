# ADR: First-Class Widget Bindings and Dependency Graph

- Status: Accepted
- Date: 2026-04-02

## Context

The current widget platform is strong at local widget configuration and weak at inter-widget
composition.

Today:

- [`src/widgets/types.ts`](../src/widgets/types.ts) defines `WidgetDefinition`,
  `WidgetControllerArgs`, and widget component/settings props, but there is no first-class widget
  IO metadata and no first-class resolved input contract.
- [`src/dashboards/types.ts`](../src/dashboards/types.ts) defines `DashboardWidgetInstance` with
  `props`, `runtimeState`, and `presentation`, but no canonical binding field for graph edges.
- [`src/widgets/shared/widget-settings.tsx`](../src/widgets/shared/widget-settings.tsx) edits
  widget `title`, `props`, and `presentation`; it has no notion of bindings.
- [`src/widgets/shared/widget-schema.ts`](../src/widgets/shared/widget-schema.ts) resolves
  controller context from local widget state only.
- [`src/dashboards/DashboardWidgetRegistry.tsx`](../src/dashboards/DashboardWidgetRegistry.tsx) is
  a flat runtime index of mounted widget instances, not a composition or dependency layer.

Inter-widget dependencies already exist in extension code, but they are implicit and
widget-specific. The clearest example is the Main Sequence Data Node family:

- [`extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx`](../extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx)
  resolves dependencies from `sourceMode` and `sourceWidgetId`, excludes self-references, and
  restricts the producer type.
- The same helper merges upstream source props into consumer-facing effective props.
- Consumer widgets and controllers still import producer-family helpers and runtime normalizers,
  for example:
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/MainSequenceDataNodeVisualizerWidget.tsx`](../extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/MainSequenceDataNodeVisualizerWidget.tsx)
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/controller.ts`](../extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/controller.ts)

This means a single dependency is currently spread across:

- persisted props
- widget-specific binding helpers
- widget-family runtime normalizers
- controller logic
- schema option generation

That design is too implicit for the product direction we want. Widgets are no longer just display
surfaces; they need to behave like application-building components with explicit connections,
typed contracts, and an extractable graph.

This ADR adopts the reviewed widget-bindings bundle direction, but narrows it to the constraints of
this repo:

- graph edges must become first-class and additive
- Data Node composition must move to canonical bindings only
- generic runtime output resolution must stay conservative and pure
- hook-based or family-specific runtime composition must remain behind adapters until it is made
  safe to centralize

## Decision

We will add a first-class widget dependency model in six parts.

### 1. Widget instances will carry canonical bindings

`DashboardWidgetInstance` will gain an optional `bindings` field in
[`src/dashboards/types.ts`](../src/dashboards/types.ts).

Bindings are the canonical storage for graph edges. They are not long-term widget props.

The binding shape will stay small:

- source widget instance id
- source output id
- optional transform id for future use

This keeps graph structure separate from widget-local configuration.

### 2. Widget definitions will declare static IO metadata

`WidgetDefinition` in [`src/widgets/types.ts`](../src/widgets/types.ts) will gain optional `io`
metadata:

- input ports
- output ports
- accepted/published contracts
- input effects
- optional pure output resolution

Static IO metadata is the basis for graph extraction, validation, and future visual composition.

### 3. Input effects will describe how a connection influences the widget

Input effects will be definition-level metadata, not edge-level data.

Each input can describe what it influences:

- settings options
- default values
- durable prop values
- validation
- render outputs

Targets should point to stable schema field ids when possible, not just raw prop paths. This lets
the dependency graph answer the user-facing question: which input maps to which widget setting?

### 4. We will add a shared dependency layer, separate from the raw widget registry

We will keep [`DashboardWidgetRegistryProvider`](../src/dashboards/DashboardWidgetRegistry.tsx) as
the raw mounted-widget index.

On top of it, we will add a dependency/composition layer under:

- `src/dashboards/widget-dependencies.ts`
- `src/dashboards/DashboardWidgetDependencies.tsx`

That layer will be responsible for:

- binding normalization
- dependency validation
- resolved input exposure
- dependency graph extraction
- diagnostics for settings/editor surfaces

It will not become a generic hook host for arbitrary producer logic in the first implementation
slice.

### 5. Generic runtime output resolution will be allowed only for pure resolvers

Static graph extraction must stay metadata-only.

Generic runtime output publication, when supported, will be limited to optional pure resolvers over
widget `props` and `runtimeState`. The generic dependency layer will not execute hooks, network
queries, or arbitrary render-time producer logic.

This restriction is deliberate because current controller logic already uses hooks, for example in
the Data Node shared controller path. Hook-based and family-specific composition will remain behind
family adapters until it is safe to centralize.

### 6. Main Sequence Data Node widgets are the first implemented family

The Data Node family already has real composition semantics and is the best first adopter.

We introduce a shared Main Sequence source contract under
`extensions/main_sequence/extensions/workbench/widget-contracts/` and bind the Data Node producer
and consumer widgets through definition-level IO metadata.

The first implemented contract must be richer than a plain dataset. It must include the field
metadata currently needed by settings and controller logic, not just `rows` and `columns`.

## Target Model

### Widget definition metadata

The platform will add additive types similar to:

- `WidgetContractId`
- `WidgetPortBinding`
- `WidgetInputEffect`
- `WidgetInputPortDefinition`
- `WidgetOutputPortDefinition`
- `WidgetIoDefinition`
- `ResolvedWidgetInput`
- `ResolvedWidgetInputs`

One decision is intentional here:

1. `resolveValue` will be optional and pure.
   It is a conservative generic path, not a mandatory runtime engine for every widget family.

### Binding storage

Bindings will be stored on widget instances as instance-level graph edges.

This makes these two concerns explicit:

- widget props configure the widget itself
- bindings connect the widget to other widgets

### Dependency graph extraction

The extracted graph will be metadata-driven and serializable.

Nodes will include at least:

- widget instance id
- widget definition id
- display title
- declared inputs
- declared outputs

Edges will include at least:

- source widget id
- source output id
- target widget id
- target input id
- resolved contract id
- validation status
- input effects

### Validation statuses

The dependency layer will explicitly represent invalid edges, including:

- `unbound`
- `missing-source`
- `missing-output`
- `contract-mismatch`
- `self-reference-blocked`
- `valid`

This is required for both graph extraction and binding-editor diagnostics.

## Scope Of The First Implementation Slice

This ADR covers the implementation slice we will land next. It is deliberately additive and
conservative.

### Platform type and persistence work

We will modify:

- [`src/widgets/types.ts`](../src/widgets/types.ts)
- [`src/dashboards/types.ts`](../src/dashboards/types.ts)
- [`src/features/dashboards/custom-dashboard-storage.ts`](../src/features/dashboards/custom-dashboard-storage.ts)
- [`src/features/dashboards/workspace-api.ts`](../src/features/dashboards/workspace-api.ts)

That work includes:

- adding `bindings` to widget instances
- normalizing bindings alongside existing widget recursion
- round-tripping bindings through workspace JSON flows
- adding a dedicated binding update mutation
- clearing widget `runtimeState` when bindings change

Runtime invalidation on rebind is a deliberate default. Binding changes alter upstream data shape
and should not reuse stale runtime caches.

### Shared dependency/composition layer

We will add:

- `src/dashboards/widget-dependencies.ts`
- `src/dashboards/DashboardWidgetDependencies.tsx`

This layer will:

- normalize bindings
- recurse through top-level widgets and row children
- include sidebar-only widgets as graph nodes
- expose resolved inputs where they can be safely resolved
- expose graph extraction and diagnostics hooks
- expose pure graph-connection parsing, validation, and binding add/remove helpers for route-level
  visual editors

The provider must wrap all current widget host surfaces so settings-side and runtime-side behavior
do not diverge:

- [`src/features/dashboards/DashboardCanvas.tsx`](../src/features/dashboards/DashboardCanvas.tsx)
- [`src/features/dashboards/CustomDashboardStudioPage.tsx`](../src/features/dashboards/CustomDashboardStudioPage.tsx)
- [`src/features/dashboards/CustomWidgetSettingsPage.tsx`](../src/features/dashboards/CustomWidgetSettingsPage.tsx)

### Controller and widget plumbing

We will extend controller plumbing first.

`useResolvedWidgetControllerContext(...)` in
[`src/widgets/shared/widget-schema.ts`](../src/widgets/shared/widget-schema.ts) will inject
`resolvedInputs` when the dependency provider is present.

We will then progressively extend widget component props so instance render paths can consume
resolved inputs where needed. Controller plumbing comes first because settings logic already relies
on controller context heavily.

### Binding editor

We will add a dedicated `Bindings` tab to the widget settings page instead of stuffing graph
editing into the raw props editor.

New shared UI:

- `src/widgets/shared/WidgetBindingPanel.tsx`

Initial host:

- [`src/features/dashboards/CustomWidgetSettingsPage.tsx`](../src/features/dashboards/CustomWidgetSettingsPage.tsx)

The binding panel will:

- list declared inputs for the selected widget
- show compatible source widgets and outputs as separate selectors per target input
- surface input effects
- show validation state
- write `bindings`, not widget props

### Route-level graph editor

We will also expose a dedicated workspace graph route backed by React Flow.

That route will:

- live under `?workspace=<id>&view=graph`
- render one node per widget instance
- render one edge per canonical binding
- include sidebar-only widgets and collapsed-row children
- keep graph node positions session-local instead of persisting a second layout model
- normalize connect/disconnect actions back into canonical `bindings`

React Flow is only the presentation layer for this surface. The graph route must reuse the shared
dependency layer for connection parsing, validation, and canonical binding mutation rules instead
of creating a second graph semantics module.

### Main Sequence first adopter

We will add Main Sequence contract and adapter files under:

- `extensions/main_sequence/extensions/workbench/widget-contracts/`
- `extensions/main_sequence/extensions/workbench/widgets/data-node-shared/`

The Data Node implementation will:

- add producer output metadata
- add consumer input metadata
- route source resolution through canonical widget bindings
- progressively move consumers away from importing producer internals directly

The first contract must preserve the current effective source shape used by controllers and
settings. It should include field metadata and upstream source metadata in addition to rows and
status.

## Binding Rules

The current implementation follows these rules:

1. Canonical `bindings` are the only supported graph-edge model.
2. Graph extraction reads widget definitions plus persisted `bindings`; it does not infer edges
   from widget props.
3. Graph extraction must recurse through `row.children`, not just top-level widget arrays.
4. Sidebar-only widgets remain graph nodes because they still participate in runtime composition.
5. Binding changes clear `runtimeState` by default.
6. Data Node consumers no longer resolve `sourceWidgetId` props as a fallback path.
7. The route-level graph editor reuses the shared dependency layer for graph semantics instead of
   duplicating validation or binding rules in a React Flow-specific model.

## Consequences

### Positive

- widget-to-widget composition becomes explicit and machine-readable
- graph extraction becomes possible without executing widget code
- settings can explain which connection influences which fields or render paths
- bindings stop polluting widget-local prop contracts
- the platform gains a stable base for future graph visualization and connection authoring
- the Data Node family now has one consistent composition path instead of mixed prop/binding wiring

### Tradeoffs

- the widget type surface becomes larger
- workspace persistence and normalization touch more files than a simple type change
- some widget families will still need adapters until their output semantics can be made pure

## Deliberate Non-Decisions

This ADR does not decide:

- generic hook-based centralized output publication
- per-widget custom runtime invalidation strategies
- repo-wide migration of every widget family in a single change
- whether future contracts should support transforms beyond storing `transformId`

## Rejected Alternatives

### Keep dependencies embedded in widget props

Rejected because props are widget-local configuration, not durable graph edges. Keeping connections
inside props prevents clean graph extraction, validation, and multi-port composition.

### Build graph extraction directly from runtime widget helpers

Rejected because it couples the platform graph model to family-specific render/controller code and
makes extraction dependent on executing widget logic.

### Centralize all runtime composition immediately

Rejected because current widget families still contain hook-based and producer-specific resolution
paths. Forcing everything through a generic runtime engine now would be fragile and likely break
existing behavior.

### Keep props-based Data Node sourcing beside bindings indefinitely

Rejected because it keeps graph edges split across two models, makes diagnostics ambiguous, and
undermines the point of first-class widget composition.

## Implementation Checklist

The implementation that follows this ADR should include, at minimum:

1. additive `bindings` and `io` types
2. binding normalization and workspace round-trip support
3. dependency extraction and diagnostics helpers
4. host-surface dependency provider integration
5. `updateDashboardWidgetBindings(...)` with runtime reset
6. a `Bindings` tab in widget settings
7. Main Sequence Data Node contract and binding-only consumer wiring
8. controller-path `resolvedInputs` plumbing
9. a route-level graph editor that reads and writes canonical bindings through the same dependency layer

That is the intended safe slice: enough structure to make widget dependencies first-class now,
without forcing a repo-wide runtime rewrite.
