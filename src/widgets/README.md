# Widgets

This directory contains the Command Center widget platform, including the shared widget contract, built-in widgets, extension-owned widgets, and reusable presentation primitives.

## Main entry points

- `types.ts`: shared widget definition contract, widget render props, and the optional settings component contract.
- `types.ts`: shared widget definition contract, widget render props, optional header actions, and the optional settings component contract.
- `shared/widget-frame.tsx`: common widget chrome used by dashboard surfaces.
- `shared/chrome.ts`: shared widget-shell markers used so themes can target widget chrome consistently across runtime dashboards and the workspace builder.
- `shared/widget-settings.tsx`: shared settings trigger and modal used by dashboard widgets and the custom workspace studio.
- `core/`: built-in widgets shipped with the core extension.
- `extensions/`: optional widget implementations used by example or third-party extensions.

## Notable behavior

- A `WidgetDefinition` is the reusable widget type: metadata, render component, and optional typed settings UI.
- `WidgetDefinition` can now also declare static `io` metadata for widget inputs, outputs,
  accepted/published contracts, input effects, and pure output publication.
- Widgets can also declare pure instance-scoped `resolveIo(...)` when their ports depend on saved
  widget instance configuration rather than only the static widget definition.
- Widgets can now also declare `execution` separately from `io`. `resolveIo(...)` stays the pure
  dataflow surface, while `execution` is the opt-in runtime contract for widgets that actively run
  work and publish outputs through runtime-state patches.
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
- Live backend mode now also projects widget definitions into a JSON-safe type manifest and syncs
  that catalog on authenticated session startup. Runtime-only function properties such as React
  components, controller hooks, `resolveIo`, and output resolvers are not sent verbatim; the sync
  keeps only serializable metadata for schema, IO, permissions, tags, and default presentation.
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
- The binding UI keeps graph edges port-to-port, but a selected binding can now optionally project a
  selected array item or nested field from a structured output before compatibility is evaluated
  against the target input. Ordered `transformSteps` are the canonical model, while legacy
  `transformId` / `transformPath` fields remain only as a backward-compatible mirror for older
  persisted dashboards.
- Executable widget graphs are coordinated from the dashboard layer, not by widgets calling each
  other directly. Widget execution should return runtime-state patches and let the shared
  dependency model resolve outputs from runtime state.
- Output resolvers can also receive the widget's current `resolvedInputs`, so widgets with derived
  outputs do not need to wait for a mounted component to republish runtime state before downstream
  bindings can read the value.
- Static dashboard surfaces currently keep widget settings changes only for the current page session.
- The custom workspace studio writes widget settings into the workspace draft, and those changes persist once the user saves the workspace.
- Stateful widgets can report runtime state back through `WidgetComponentProps.onRuntimeStateChange` so Workspaces JSON snapshots can round-trip view state such as zoom, pan, or selected node context.
- Widgets can also provide optional header actions through the shared shell when a control belongs in the widget chrome instead of inside the widget body.
- Widget shells expose shared markers through `shared/chrome.ts`, so theme-specific CSS can style widget chrome separately from generic cards when needed.
- Shared widget shells no longer add default body padding. If a widget needs internal spacing, the widget component itself must add it explicitly.

## Maintenance notes

- Prefer wiring new widget-level configuration through the shared settings modal before adding page-specific controls.
- Use `runtimeState` only for ephemeral view state that should round-trip with a workspace; keep durable configuration in widget `props`.
- If a widget needs a richer configuration experience, provide `settingsComponent` on its `WidgetDefinition` instead of forking the modal shell.
- Be explicit about whether a surface is rendering a preconfigured widget instance or a user-configurable widget instance.
- Keep widget module documentation close to the implementation when adding new widget folders.
