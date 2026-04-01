# Widget Reactor Review

Context: review of the proposed binding-centric widget architecture against the current repo state.

## Directionally correct

The proposal is directionally right for this codebase. The repo is strong on local widget config and weak on explicit inter-widget composition.

Verified repo facts:

- Shared widget settings currently edit `title`, `props`, and `presentation`, not graph edges.
  - `src/widgets/shared/widget-settings.tsx:124-128`
  - `src/features/dashboards/CustomWidgetSettingsPage.tsx:181-188`
- The shared widget controller contract only receives local widget state.
  - `src/widgets/types.ts:55-62`
  - `src/widgets/shared/widget-schema.ts:197-208`
- `DashboardWidgetInstance` has `props`, `runtimeState`, and `presentation`, but no first-class binding field.
  - `src/dashboards/types.ts:94-105`
- Raw cross-widget lookup exists, but only as a flat registry of mounted widget instances.
  - `src/dashboards/DashboardWidgetRegistry.tsx:3-27`
- Current Data Node composition is implicit and consumer-driven:
  - source binding is resolved from widget props via `sourceMode` / `sourceWidgetId`
    - `extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx:438-478`
  - consumers import producer-specific runtime normalizers
    - `extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/MainSequenceDataNodeVisualizerWidget.tsx:26-43`
    - `extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/controller.ts:14-18`
    - `extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/controller.ts:61-90`
- There is already one ad hoc output-like publication pattern in `AppComponent` via `runtimeState.publishedOutputs`.
  - `src/widgets/core/app-component/appComponentModel.ts:33-45`
  - `src/widgets/core/app-component/AppComponentWidget.tsx:183-202`

So the proposal is solving a real architectural gap, not a hypothetical one.

## Repo-specific concerns

### 1. Legacy binding inference is more complex than `propPath: "sourceWidgetId"`

The current Data Node binding model is not just "read a widget id from props".

Current behavior also depends on:

- `sourceMode === "filter_widget"`
- self-exclusion using `currentWidgetInstanceId`
- source widget type restriction to `mainSequenceDataNodeWidgetId`

Code:

- `extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx:447-457`
- `extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx:469-478`

Question:

- Should `legacyBinding` stay a simple static `propPath`, or does this repo need a richer legacy inference hook/function per input?

Concern:

- A plain `propPath` bridge will not faithfully represent the current semantics for Data Node source resolution.

### 2. Current consumers inherit both upstream props and upstream runtime, not just runtime rows

The current Data Node visualizer does not only consume producer runtime output. It also merges resolved source props from the upstream widget into its effective props.

Code:

- upstream props are pulled from the referenced widget:
  - `extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx:459-466`
- controller merges source props into resolved config:
  - `extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx:556-565`
- widget render path also merges `effectiveSourceProps`:
  - `extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/MainSequenceDataNodeVisualizerWidget.tsx:43-50`

Question:

- Does the new contract model collapse both categories into one contract payload, or do we need separate output ports for:
  - normalized dataset
  - resolved source configuration

Concern:

- A single `dataset` output may not fully cover the current behavior unless it also carries source-config fields that are currently inherited through props.

### 3. Centralized runtime output resolution has a hooks problem

The proposal correctly separates static graph metadata from runtime output resolution, but the runtime side still needs an execution model.

Today, controller contexts are hook-based:

- `WidgetController.useContext` is called inside React render
  - `src/widgets/types.ts:64-69`
  - `src/widgets/shared/widget-schema.ts:197-208`
- shared source controller uses `useQuery`
  - `extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx:533-592`

Question:

- If `DashboardWidgetIoProvider` resolves outputs centrally, where will hook-based producer context run?

Concern:

- If output resolvers depend on `controllerContext`, the provider cannot compute them from plain data alone unless it introduces another hook-hosting layer.

Suggested verification point:

- keep `outputResolvers` pure over `props` and `runtimeState` where possible, or explicitly design a hook-safe runtime host for producer output resolution.

### 4. Provider coverage must include more than the main dashboard canvas

The proposal suggests adding an IO provider around the dashboard/widget tree. In this repo, widget trees are mounted in multiple host surfaces.

Current hosts:

- read-only dashboards:
  - `src/features/dashboards/DashboardCanvas.tsx:456-457`
- workspace studio:
  - `src/features/dashboards/CustomDashboardStudioPage.tsx:2752-2753`
- full widget settings page:
  - `src/features/dashboards/CustomWidgetSettingsPage.tsx:71-78`

Question:

- Will `DashboardWidgetIoProvider` wrap all three surfaces?

Concern:

- If the provider only wraps the dashboard canvas and studio, settings-side controller logic will still be using raw registry access and will diverge from runtime binding resolution.

### 5. Render call sites will need a broad prop-plumbing change

Today, widget components are mounted with:

- `widget`
- `instanceTitle`
- `props`
- `presentation`
- `runtimeState`
- `onRuntimeStateChange`

The shared component prop type has no `instanceId` or `resolvedInputs`.

Code:

- type surface:
  - `src/widgets/types.ts:183-190`
- dashboard canvas mounts:
  - `src/features/dashboards/DashboardCanvas.tsx:471-497`
- workspace settings mounts:
  - `src/features/dashboards/CustomWidgetSettingsPage.tsx:97-119`
- studio mounts also follow this pattern
  - `src/features/dashboards/CustomDashboardStudioPage.tsx:2797-2814`

Question:

- Is the plan to add `resolvedInputs` everywhere in one sweep, or to first expose them only through controller context?

Concern:

- This is a wide host-surface change, not just a widget-definition change.

### 6. The settings stack currently has no concept of bindings

The generic settings flow is explicitly built around:

- `draftProps`
- `draftPresentation`
- instance title

Code:

- `src/widgets/shared/widget-settings.tsx:175-194`
- `src/widgets/shared/widget-settings.tsx:435-459`
- `src/features/dashboards/CustomWidgetSettingsPage.tsx:165-189`

Question:

- Should bindings be edited inside `WidgetSettingsPanel`, or should the new binding UI live beside it at the page level?

Concern:

- Adding bindings only to storage/types without a host-level mutation flow will leave the feature half-integrated.

### 7. Binding mutations probably need runtime-state invalidation rules

Current widget setting updates clear `runtimeState` whenever `props` change.

Code:

- `src/features/dashboards/custom-dashboard-storage.ts:1304-1340`
- especially `runtimeState: "props" in settings ? undefined : widget.runtimeState`
  - `src/features/dashboards/custom-dashboard-storage.ts:1334-1337`

Question:

- Should changing `bindings` also invalidate runtime state?

Concern:

- If bindings determine upstream data shape, keeping stale runtime state after a rebinding could preserve invalid caches or old derived state.

### 8. Persistence changes are bigger than the proposal text implies

Adding `bindings` is not just a type change. It touches all dashboard normalization and transport paths.

Current persistence/normalization touchpoints:

- widget instance normalization:
  - `src/features/dashboards/custom-dashboard-storage.ts:400-440`
- top-level dashboard normalization:
  - `src/features/dashboards/custom-dashboard-storage.ts:546-548`
- serialized mutation payloads:
  - `src/features/dashboards/workspace-api.ts:640-653`
- backend payload coercion:
  - `src/features/dashboards/workspace-api.ts:725-756`
- loose widget array coercion from payload:
  - `src/features/dashboards/workspace-api.ts:333-336`

Question:

- Will `bindings` be normalized, cloned, and validated recursively everywhere `widgets` flow through the system?

Concern:

- This repo currently trusts `widgets` arrays fairly loosely in some API coercion paths. `bindings` will need explicit normalization to avoid malformed edges leaking into workspace state.

### 9. Row children make graph extraction recursive

The proposed graph extractor iterates `dashboard.widgets`, but this repo allows nested widget instances inside row state.

Code:

- row children live here:
  - `src/dashboards/types.ts:89-92`
- other dashboard utilities already recurse row children:
  - `src/features/dashboards/workspace-api.ts:683-721`

Question:

- Are row children included as first-class graph nodes?

Concern:

- A top-level-only extractor will miss hidden child instances inside collapsed rows.

### 10. Sidebar-only widgets still matter to the application graph

This repo already treats sidebar-only widgets as mounted runtime participants, not just hidden presentation elements.

Code:

- sidebar placement is part of widget presentation:
  - `src/widgets/types.ts:24-28`
- hidden runtime mounts in read-only dashboard:
  - `src/features/dashboards/DashboardCanvas.tsx:460-500`
- hidden runtime mounts in widget settings:
  - `src/features/dashboards/CustomWidgetSettingsPage.tsx:80-123`
- hidden runtime mounts in workspace studio:
  - `src/features/dashboards/CustomDashboardStudioPage.tsx:2779-2795`

Question:

- Should sidebar-only widgets appear in the dependency graph even when they have no visible canvas card?

Recommendation:

- yes, because the repo already treats them as active runtime publishers/consumers.

### 11. Extending `WidgetDefinition` generics will ripple through the registry and helper types

The proposal sketches `WidgetDefinition<TProps, TContext = unknown>`. That is probably fine, but it is a broad type ripple.

Current surfaces tied to `WidgetDefinition<TProps>` include:

- widget type contract:
  - `src/widgets/types.ts:72-165`
- app extension registry:
  - `src/app/registry/types.ts:6-17`

Question:

- Do we want to add a second generic to `WidgetDefinition`, or keep output resolver context loosely typed at first to minimize churn?

Concern:

- This is not a blocker, but it is a repo-wide type migration, not a local enhancement.

## Things the proposal gets especially right

These points fit the repo well and should be preserved:

- Keep graph edges out of `props` long term.
- Keep `DashboardWidgetRegistryProvider` as the raw widget-instance index and build IO/composition as a separate layer on top.
- Keep UI-only relationships out of the application dependency graph:
  - `showHeader`
  - `surfaceMode`
  - `placementMode`
  - companion cards and exposed field popouts
- Keep graph extraction metadata-driven and static.
- Move contract payload types into shared extension-common modules, not individual producer widget files.

## Recommended repo-specific guardrails

1. Make `bindings` canonical, but ship with legacy inference first.
2. Do not model legacy inference as only `propPath`; the Data Node family already needs richer inference semantics.
3. Resolve whether "source config inheritance" is part of the same contract as "dataset output" before migrating the Data Node family.
4. Decide early whether output resolvers must be pure or whether the platform will support hook-based producer output resolution.
5. Add the IO provider to all current widget host surfaces, not only the dashboard canvas.
6. Make graph extraction recursive over row children.
7. Treat sidebar-only widgets as graph nodes.
8. Define runtime-state invalidation rules for rebinding before adding the binding form.

## Bottom line

The proposal matches the repo's real architectural gap, and its target direction is good. The biggest repo-specific risks are:

- oversimplifying legacy inference
- underestimating the current mix of upstream props plus upstream runtime
- not accounting for hook-based controller/output resolution
- missing the number of host surfaces and persistence paths that must change together

Those are the points I would want verified before pushing the design from ADR into implementation.
