# Widgets

This directory contains the Command Center widget platform, including the shared widget contract, built-in widgets, extension-owned widgets, and reusable presentation primitives.

## Main entry points

- `types.ts`: shared widget definition contract, widget render props, and the optional settings component contract.
- `types.ts`: shared widget definition contract, widget render props, optional header actions, and the optional settings component contract.
- `organization-config-api.ts`: authenticated API client for sparse organization-scoped widget type configuration rows.
- `registered-widget-types-api.ts`: authenticated API client plus shared React Query hook for the
  backend registered widget-type catalog used to gate widget availability in user-facing catalogs.
- `WidgetOrganizationConfigurationProvider.tsx`: app-wide provider and hooks for resolving optional organization widget type configuration overrides at runtime.
- `shared/widget-frame.tsx`: common widget chrome used by dashboard surfaces.
- `shared/chrome.ts`: shared widget-shell markers used so themes can target widget chrome consistently across runtime dashboards and the workspace builder.
- `shared/widget-settings.tsx`: shared settings trigger and modal used by dashboard widgets and the custom workspace studio.
- `core/`: built-in widgets shipped with the core extension.
- `extensions/`: optional widget implementations used by example or third-party extensions.

## Widget Readmes

Use these local docs before reading the implementation in code:

- Core widgets:
  [`core/app-component/README.md`](./core/app-component/README.md),
  [`core/connection-query/README.md`](./core/connection-query/README.md),
  [`core/graph/README.md`](./core/graph/README.md),
  [`core/markdown-note/README.md`](./core/markdown-note/README.md),
  [`core/rich-text-note/README.md`](./core/rich-text-note/README.md),
  [`core/statistic/README.md`](./core/statistic/README.md),
  [`core/tabular-transform/README.md`](./core/tabular-transform/README.md),
  [`core/table/README.md`](./core/table/README.md),
  [`core/workspace-row/README.md`](./core/workspace-row/README.md)
- Platform extension widget families:
  [`extensions/ag-grid/README.md`](./extensions/ag-grid/README.md),
  [`extensions/echarts/README.md`](./extensions/echarts/README.md),
  [`extensions/lightweight-charts/README.md`](./extensions/lightweight-charts/README.md)
- Main Sequence widget families:
  [`extensions/main_sequence/extensions/workbench/widgets/README.md`](../../extensions/main_sequence/extensions/workbench/widgets/README.md),
  [`extensions/main_sequence/extensions/markets/widgets/README.md`](../../extensions/main_sequence/extensions/markets/widgets/README.md)

## Notable behavior

- A `WidgetDefinition` is the reusable widget type: metadata, render component, and optional typed settings UI.
- `WidgetDefinition` can now also declare static `io` metadata for widget inputs, outputs,
  accepted/published contracts, input effects, and pure output publication.
- Widgets can also declare pure instance-scoped `resolveIo(...)` when their ports depend on saved
  widget instance configuration rather than only the static widget definition.
- Widgets can now also declare `execution` separately from `io`. `resolveIo(...)` stays the pure
  dataflow surface, while `execution` is the opt-in runtime contract for widgets that actively run
  work and publish outputs through runtime-state patches.
- Widget definitions now also carry `widgetVersion` plus an explicit `registryContract` used for
  backend widget-type publication and agent-facing authoring metadata.
- Widget catalog descriptions and registry usage guidance are sourced from each widget module's
  `USAGE_GUIDANCE.md` file through `resolveWidgetDescription(...)` and
  `resolveWidgetUsageGuidance(...)`. The `buildPurpose` section becomes
  `WidgetDefinition.description`, and the full structured guidance becomes backend-synced
  `usageGuidance`.
- Widget definitions can now also declare optional `organizationConfiguration` metadata. This is an
  opt-in widget capability used when one widget type supports organization-scoped defaults or
  guardrails. Widgets that omit it behave exactly as they do today.
- Widget definitions can now also expose `buildAgentSnapshot(...)`, a client-side live snapshot
  hook used by workspace archive capture. This is intentionally separate from the backend-facing
  widget registry contract: registry metadata explains how to build a widget, while
  `buildAgentSnapshot(...)` explains what a mounted widget is currently showing.
- Widgets that implement `buildAgentSnapshot(...)` now also publish one synthetic `agent-context`
  output with contract `core.widget-agent-context@v1`. That output is derived from the compact
  `evidence` snapshot profile so agent-facing consumers such as `Agent Terminal` can reason over
  what widgets currently show without maintaining a second serializer. See
  [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](../../docs/adr/adr-widget-agent-context-bindings.md).
- Output ports can optionally describe their structured value shape through `valueDescriptor`, and
  canonical bindings can attach lightweight transform metadata such as array-item selection and
  nested path extraction without changing the underlying port-to-port graph model.
- Widget definitions now inherit one shared platform default size through `defineWidget(...)`. Only
  true structural exceptions, such as the workspace row widget, should override that default at the
  definition layer.
- Widget definitions can now also declare one canonical `workspaceIcon`. Workspace rails, graph
  cards, and other workspace surfaces should resolve icons through that shared definition-level
  field plus the shared workspace icon resolver. Legacy `railIcon` remains only as a backward-
  compatible fallback while older widgets migrate.
- Live backend mode projects widget definitions into a JSON-safe type manifest for explicit admin
  publication. Runtime-only function properties such as React components, controller hooks,
  `resolveIo`, and output resolvers are not sent verbatim; the sync keeps only the explicit
  serializable widget type contract.
- When a widget publishes `organizationConfiguration`, the widget-type sync manifest now also
  publishes its organization-configuration schema, defaults, and version so backend widget-type
  rows can advertise that capability explicitly.
- User-facing widget catalogs can now optionally enforce backend registration as an availability
  gate. When the registered-widget-types list endpoint is configured, unsynced widget definitions
  must stay hidden even if they exist in the local frontend build.
- `registryContract` is the backend-facing explanation layer for widget behavior. Use it to publish
  configuration summary, runtime ownership, IO semantics, capabilities, usage guidance, and examples.
- Simple widgets may still rely on safe fallback derivation from `schema`, `io`, `execution`, and
  `workspaceRuntimeMode`, but dynamic or non-trivial widgets should define an explicit
  `registryContract`.
- The workspace studio does not use per-widget `defaultSize` as the insertion size for fresh
  custom-workspace widgets. New non-row widgets start from one shared workspace baseline so the
  builder stays predictable across widget families.
- `WidgetDefinition` can also declare optional responsive constraints. `responsive.minWidthPx`
  gives dashboard viewers a stable lower bound when they derive runtime column counts from actual
  canvas width.
- A dashboard or app mounts widget instances. Each instance has its own `title` and `props`.
- Widget instances can also carry optional `runtimeState` when the widget needs to persist view-level state separately from props.
- Widget instances may also carry canonical `bindings` separately from props. These are graph edges,
  not local widget configuration.
- Widget settings are instance-scoped, not global to the widget definition. Two surfaces can use the same widget definition with different props.
- App-owned surfaces can use preconfigured widget instances so users consume the widget without needing to configure it.
- Custom dashboard and workspace flows are the place where instance settings are intended to be user-editable.
- App-owned surfaces should override widget size in their own layout/container implementation when a
  route needs a specific presentation. Do not push route-specific size requirements back into the
  reusable widget definition.
- The shared settings modal supports title overrides, shared widget chrome options such as `showHeader`, and raw JSON prop editing for any widget instance.
- Workspace widget settings now also expose a dedicated `Bindings` tab for widgets that declare
  inputs, including inputs resolved dynamically from saved widget instance configuration. Do not
  stuff inter-widget graph edges into raw props editors.
- Inputs marked with `cardinality: "many"` are now first-class in the shared bindings UI. Settings
  can add, remove, and preserve several upstream sources for one input without falling back to raw
  JSON editing.
- The binding UI keeps graph edges port-to-port, but a selected binding can now optionally project a
  selected array item or nested field from a structured output before compatibility is evaluated
  against the target input. Ordered `transformSteps` are the canonical model, while legacy
  `transformId` / `transformPath` fields remain only as a backward-compatible mirror for older
  persisted dashboards.
- Executable widget graphs are coordinated from the dashboard layer, not by widgets calling each
  other directly. Widget execution should return runtime-state patches and let the shared
  dependency model resolve outputs from runtime state.
- Workspace data access should use the core Connection Query source widget and the core Tabular
  Transform widget for tabular reshaping. Generic consumers bind to the published
  `core.tabular_frame@v1` output instead of querying connection instances directly.
- Output resolvers can also receive the widget's current `resolvedInputs`, so widgets with derived
  outputs do not need to wait for a mounted component to republish runtime state before downstream
  bindings can read the value.
- Static dashboard surfaces currently keep widget settings changes only for the current page session.
- The custom workspace studio writes widget settings into the workspace draft, and those changes persist once the user saves the workspace.
- Stateful widgets can report runtime state back through `WidgetComponentProps.onRuntimeStateChange` so Workspaces JSON snapshots can round-trip view state such as zoom, pan, or selected node context.
- Widgets can now also opt into shared inline canvas editing through `canvasEditing.mode`. Hosts
  such as the workspace studio may keep those widget bodies interactive during edit mode and pass
  `WidgetComponentProps.editable` plus `WidgetComponentProps.onPropsChange` so the widget can write
  directly into the current workspace draft.
- Widgets that participate in the live workspace archive should keep `buildAgentSnapshot(...)`
  deterministic and serialization-friendly. Prefer structured summaries, small evidence payloads,
  and opt-in larger exports through the archive profile instead of depending on DOM scraping alone.
- `buildAgentSnapshot(...)` now also feeds the synthetic `agent-context` binding output. Keep
  snapshots stable enough that they can be consumed both by archive capture and by bound agent
  widgets.
- Widgets can also provide optional header actions through the shared shell when a control belongs in the widget chrome instead of inside the widget body.
- Widget shells expose shared markers through `shared/chrome.ts`, so theme-specific CSS can style widget chrome separately from generic cards when needed.
- Shared widget shells no longer add default body padding. If a widget needs internal spacing, the widget component itself must add it explicitly.

## Maintenance notes

- Prefer wiring new widget-level configuration through the shared settings modal before adding page-specific controls.
- Keep this index updated when a new widget folder adds its own `README.md`.
- Add a colocated `USAGE_GUIDANCE.md` for every widget type and import it with `?raw`; do not
  hardcode top-level `WidgetDefinition.description` text or `registryContract.usageGuidance` inline in
  `definition.ts`.
- Bump `widgetVersion` whenever widget authoring semantics change materially, including changes to
  configuration model, accepted inputs, published outputs, runtime ownership, or capability modes.
- Treat `organizationConfiguration` as widget-type metadata, not instance content. Put
  organization-scoped defaults or ceilings there only when the widget type explicitly supports that
  capability.
- Use `runtimeState` only for ephemeral view state that should round-trip with a workspace; keep durable configuration in widget `props`.
- Use inline canvas editing only for widgets that genuinely need on-canvas authoring. Most widgets
  should still stay read-only in workspace edit mode.
- If a widget needs a richer configuration experience, provide `settingsComponent` on its `WidgetDefinition` instead of forking the modal shell.
- Be explicit about whether a surface is rendering a preconfigured widget instance or a user-configurable widget instance.
- Keep widget module documentation close to the implementation when adding new widget folders.
