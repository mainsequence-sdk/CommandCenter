# Workspace Runtime Performance Remediation

This document tracks the main performance problems in the workspace runtime and the ordered fixes
we should apply. It exists so we stop treating obvious hot paths as harmless "simple" patterns and
instead make the runtime cost explicit.

## Current problems

### 1. Whole-workspace deep serialization for dirtiness

Current behavior:

- `useCustomWorkspaceStudio.ts` computes:
  - `dirty = JSON.stringify(draftCollection) !== JSON.stringify(savedCollection)`
  - `selectedWorkspaceDirty = JSON.stringify(selectedDashboard) !== JSON.stringify(savedSelectedDashboard)`
- `CustomWidgetSettingsPage.tsx` also compares the selected workspace against its saved version
  with `JSON.stringify(...)`.

Why this is a problem:

- It serializes large nested workspace objects on many renders.
- The cost scales with total workspace size instead of the changed part.
- It creates large temporary strings and unnecessary GC pressure.

Planned fix:

- Replace deep serialization checks with explicit draft revisions and per-workspace dirty flags.
- Dashboard update helpers should mark the workspace dirty when they mutate it.
- Save/reset operations should clear or realign that flag.
- If we still need structural equality in a few places, compute a cached stable signature once per
  committed workspace update, not once per render.

Status: `todo`

### 2. Full dependency model rebuild on any widget-array identity change

Current behavior:

- `DashboardWidgetDependenciesProvider` rebuilds the entire dependency model from the full widget
  tree whenever `widgets` changes.
- Because runtime-state writes and local overrides create new widget objects, this can happen often.

Why this is a problem:

- Opening or editing a single widget can invalidate the full dependency snapshot.
- Dynamic IO, outputs, and inputs are recomputed globally instead of for the affected subgraph.
- The current pattern is safe but too coarse.

Planned fix:

#### Target design

Split the current one-shot dependency model into two layers:

1. `DashboardWidgetTopology`

- Built from widget structure only:
  - widget ids
  - widget types
  - row nesting
  - bindings
- Contains:
  - flattened entries
  - entry index
  - upstream/downstream edge maps
  - static binding relationships

This layer should only rebuild when the graph structure changes, not when runtime state changes.

2. `DashboardWidgetResolutionCache`

- Built on top of the topology.
- Stores per-instance resolution results:
  - resolved IO
  - resolved outputs
  - resolved inputs
- Uses per-instance signatures so only changed instances are recomputed.

#### Per-instance signatures

Each widget instance should expose separate signatures for the parts that affect resolution:

- `structureSignature`
  - widget id
  - bindings
  - row placement/children only if relevant to traversal
- `propsSignature`
  - props that affect `resolveIo(...)`, output contracts, or controller logic
- `runtimeSignature`
  - runtime state that affects outputs

These signatures let us answer:

- did the graph structure change?
- did this widget's own resolution inputs change?
- which downstream widgets must be invalidated?

#### Incremental invalidation

When one widget changes:

1. Compare its previous and next signatures.
2. If only runtime changed:
   - recompute that widget's outputs
   - invalidate downstream resolved inputs recursively
3. If props changed and affect IO:
   - recompute that widget's IO and outputs
   - invalidate downstream recursively
4. If bindings changed:
   - rebuild topology for the affected graph
   - then recompute affected nodes only

#### Provider behavior after the refactor

`DashboardWidgetDependenciesProvider` should stop doing:

- "widgets changed -> rebuild everything"

and instead do:

- "topology signature changed -> rebuild topology"
- "instance signatures changed -> recompute affected nodes"

#### Practical outcome

After this change:

- opening widget settings should not rebuild the whole dependency graph
- changing one widget's runtime state should only invalidate its downstream consumers
- passive widgets should read cached dependency results instead of forcing a global rebuild

Status: `todo`

### 3. Repeated upstream-resolution snapshot construction

Current behavior:

- `DashboardWidgetExecution.tsx` computes `getUpstreamRequirement(...)` by building a fresh
  execution snapshot every time it is called.
- Many passive widgets call `useResolveWidgetUpstream(...)` independently.

Why this is a problem:

- The same graph analysis is repeated across many widgets in the same render pass.
- It duplicates traversal work that should be shared.

Planned fix:

- Add a provider-level cached upstream-resolution snapshot keyed by:
  - topology revision
  - instance signatures
  - target overrides hash when present
- `getUpstreamRequirement(instanceId)` should query that shared cache, not rebuild a fresh snapshot
  every time.
- Widgets should keep asking the provider for upstream state, but the provider should answer from a
  memoized graph snapshot.

Status: `todo`

### 4. Hidden mounting of the whole workspace in settings

Previous behavior:

- `CustomWidgetSettingsPage.tsx` hidden-mounts all widgets in the workspace to keep runtime outputs,
  controller context, and executable dependencies available.

Why this is a problem:

- Editing one widget pays near-dashboard runtime cost.
- Hidden widgets still run hooks, queries, controller logic, and execution checks.
- Settings becomes much slower than it needs to be.

Implemented fix:

- Replace hidden mounting with a headless runtime host.
- The settings route should use:
  - dependency provider
  - execution provider
- widget controller context
  without mounting every widget component.
- Only the edited widget and any explicitly rendered preview surface should mount.
- `main-sequence-data-node` now provides headless source publication through a first-class
  execution contract, so Data Node-family settings no longer depend on sibling component mounts.
- widget execution contexts now carry dashboard control state so headless settings execution still
  sees the active workspace time range.

Investigation:

- See [Workspace Settings Headless Runtime Investigation](./workspace-settings-headless-runtime-investigation.md).
- The investigation confirmed that the main blocker is not the generic settings shell. It is the
  Data Node source family, which still materializes published dataset runtime through mounted
  widget component side effects.

Status: `implemented`

## Fix order

1. Remove `JSON.stringify(...)` render-time dirty checks.
2. Introduce dependency topology vs resolution-cache split.
3. Add cached upstream-resolution requirements at the provider level.
4. Remove hidden full-workspace mounting from settings. Completed on 2026-04-03 through headless
   Data Node execution plus provider-backed widget settings.

This order matters:

- Fixing dirty checks reduces render churn immediately.
- Fixing dependency invalidation reduces the biggest global recomputation cost.
- Fixing upstream-resolution caching stops passive widgets from multiplying graph analysis.
- Fixing settings runtime host removes the largest "edit one widget, run all widgets" cost.

## Non-goals

- Do not add ad hoc widget-level memoization as the main solution.
- Do not special-case `AppComponent`, `Data Node`, `Graph`, or `Table` to work around global
  invalidation.
- Do not keep the current rebuild-everything model and only try to hide it behind `useMemo`.

The problem is architectural granularity, not a missing `useMemo` around an already-too-large
derivation.
