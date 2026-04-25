# Widget Shared UI

This directory contains reusable widget presentation primitives that are shared across dashboard surfaces.

## Main entry points

- `widget-frame.tsx`: standard card shell for registered widget instances, including the header chrome, optional widget-defined header actions, and state placeholders.
- `chrome.ts`: shared helpers for widget chrome options such as per-instance header visibility, plus shared widget-shell markers used by themes to style widget containers consistently.
- `widget-settings.tsx`: shared settings trigger plus the reusable full-page settings panel used to edit widget instances outside the old modal flow. It also exports the shared duplicate trigger used by workspace widget chrome.
- `WidgetSourceExplorer.tsx`: reusable source widget/source output explorer used by binding UIs. It keeps bindings port-to-port while layering collection-item selection, nested value exploration, transform selection, compatibility messaging, preview, and a richer source-widget picker (instance label + widget type + widget id) on top of structured output descriptors. Binding panels should only pass live source widgets that expose at least one output compatible with the target input directly or through a supported structured-output transform.
- `picker-field.tsx`: shared picker/listbox field used by widget settings that need searchable
  option sets without depending on an extension-specific component.
- `tabular-frame-source.ts`: shared generic tabular-frame contract, value descriptor, and
  normalization helpers used when widgets bind table-like datasets across extension boundaries.
  It defines the platform-level `columns + rows + fields + meta + source` shape so widget families
  do not invent incompatible dataset payloads. It also owns compatibility coercion from older
  backend series-shaped responses into the canonical tabular frame plus `meta.timeSeries` hints.
- `tabular-widget-source.tsx`: shared source-binding helpers for widgets that consume
  `core.tabular_frame@v1`, including field inference, manual table normalization, connection
  response/frame normalization, source-widget binding resolution, and settings-schema helper glue.
- `tabular-field-schema-inspector.tsx`: reusable settings inspector for declared or inferred
  tabular fields, including provenance, warnings, and sample-row context.
- `tabular-preview-table.tsx`: lightweight preview table for settings and connection explorers
  that need to display a small tabular frame without mounting the full table widget.
- `tabular-date-time-field.tsx`: compact date/time input field shared by source and connection
  configuration surfaces.
- `chart-data-source.ts`: shared renderer-neutral chart-data contract helper for
  `core.chart_data@v1`, including value-descriptor metadata and frame normalization for backend
  adapters that return chart-ready data rather than source time-series data.
- `widget-usage-guidance.ts`: parses raw `USAGE_GUIDANCE.md` content into the short catalog
  description assigned to `WidgetDefinition.description` and the structured `usageGuidance` payload
  published by backend widget-type sync.
- `widget-schema.ts`: shared helpers for widget schema visibility, controller context resolution, and exposed-field presentation state.
- `widget-schema-form.tsx`: generic settings form renderer for schema-based widget fields. The form
  now supports per-field layout width through `WidgetFieldDefinition.settingsColumnSpan`, so shared
  schemas can place small controls side by side instead of forcing every field onto its own row.
- `widget-setting-help.tsx`: shared `(i)` field-help tooltip primitives for widget settings and
  generated input forms. Use this instead of local tooltip implementations when a widget field needs
  concise inline guidance.
- `widget-canvas-controls.tsx`: host for schema fields that are exposed as external companion cards beside a widget instance. The workspace studio still uses it to edit exposed-field state, while the shared dashboard viewer now renders companion fields through the dashboard canvas-item/runtime layout path instead of widget-local overlays.
- `form-density.ts`: shared spacing and control-density classes for widget settings forms that need a tighter configuration surface.
  It also exposes reusable compact table-density classes for settings previews.

## Notable behavior

- Settings are intentionally instance-scoped: the shared panel edits the current dashboard widget instance, not the underlying widget definition.
- The shared settings panel is generic by default and can be extended per widget through `WidgetDefinition.schema`, `WidgetDefinition.controller`, and `WidgetDefinition.settingsComponent`.
- The shared settings panel now renders a top-level panel preview for normal panel-style widgets.
  The preview uses the live widget component with the current draft props and draft presentation
  inside `WidgetPreviewModeBoundary`, so preview-aware widgets can switch to mock/demo behavior
  without inventing separate preview components. Structural widgets such as `workspace-row` stay
  excluded because they do not render a normal panel surface.
- The shared preview should mirror the panel surface itself, not the editor chrome around it.
  Do not add extra settings-only badges, source pills, drag handles, or nested card wrappers
  around the previewed panel.
- The shared preview also supports a preview-only demo-data toggle. When enabled, the entire
  settings surface switches to an isolated demo draft instead of the real widget draft. Shared
  controls, schema-backed controls, custom settings components, and the top panel preview should
  all read and write the demo draft only.
- Demo mode must never mutate the persisted widget draft or call the host draft mutation callbacks.
  It is an in-memory authoring sandbox for the open settings session. The shared panel disables
  save while demo mode is active to keep that boundary explicit.
- Widget definitions can now provide richer preview fixtures through:
  - `mockTitle`
  - `mockProps`
  - `mockPresentation`
  - `mockResolvedInputs`
  - `mockRuntimeState`
- Use `mockResolvedInputs` for widgets whose preview depends on a bound upstream contract. Do not
  fake those previews with widget-local empty-state bypasses when the real issue is missing
  contract-shaped demo input.
- Structured output exploration belongs in the shared source explorer contract, not in widget-specific binding hacks. Widgets should expose `valueDescriptor` metadata on outputs, and shared binding surfaces should consume that metadata to render whole-output binding, array-item selection, and nested-field extraction consistently. When a descriptor is generic but a runtime value is already available, the explorer may infer temporary nested paths from that value so API-driven JSON outputs remain bindable.
- Array outputs are not flattened into pseudo-ports by the shared binding layer. The explorer keeps the graph edge anchored to the source output port, then optionally applies ordered binding transforms such as `select-array-item` followed by `extract-path`.
- Generic table-like widget bindings should use `tabular-frame-source.ts` instead of inventing extension-specific row contracts. Keep source-specific metadata nested under `source` and keep field schemas limited to generic metadata like `key`, `label`, `type`, `description`, and `nullable`.
  The canonical shared payload is:
  ```ts
  {
    status?: "idle" | "loading" | "ready" | "error",
    columns: string[],
    rows: Array<Record<string, unknown>>,
    error?: string,
    fields?: Array<{
      key: string,
      label?: string,
      type: "string" | "number" | "integer" | "boolean" | "datetime" | "date" | "time" | "json" | "unknown",
      description?: string | null,
      nullable?: boolean,
      nativeType?: string | null,
      provenance?: "backend" | "manual" | "inferred" | "derived",
      reason?: string | null,
      derivedFrom?: string[],
      warnings?: string[],
    }>,
    meta?: {
      timeSeries?: {
        shape: "long" | "wide",
        timeField: string,
        timeUnit: "ms",
        timezone: "UTC",
        sorted: boolean,
        valueField?: string,
        seriesField?: string,
        seriesLabelFields?: string[],
        valueFields?: string[],
        frequency?: string,
        calendar?: string,
        gapPolicy?: "preserve_nulls" | "drop_nulls",
        duplicatePolicy?: "error" | "first" | "latest" | "aggregate" | "preserve",
        unitByField?: Record<string, string>,
      },
      [key: string]: unknown,
    },
    source?: {
      kind: string,
      id?: string | number,
      label?: string,
      updatedAtMs?: number,
      context?: Record<string, unknown>,
    },
  }
  ```
  Required fields are `columns` and `rows`. `status`, `fields`, `meta`, `error`, and `source`
  are optional.
  When `status` is omitted, the shared normalizer infers `ready` if rows or columns are present,
  `error` if an error message exists, and `idle` otherwise.
  When `fields` are present, widget families should preserve declared metadata where possible and
  use `provenance`, `reason`, `derivedFrom`, and `warnings` to explain how runtime typing was
  resolved instead of silently overwriting the schema with row-only inference.
  When chartable time/value/series semantics are known, publish them inside `meta.timeSeries`
  rather than introducing a second widget-facing frame contract.
- Widget definitions can also set `showRawPropsEditor: false` when the shared raw JSON props editor should stay hidden and the widget should be configured only through structured settings controls.
- The shared settings panel can also expose an optional remove action from the host surface. This is important for sidebar-only widgets, because they may not have an on-canvas card chrome with a delete button.
- Schema-backed fields can optionally be exposed on the canvas through instance-level presentation state as companion cards outside the widget frame instead of being trapped inside the widget settings page.
- Schema sections render as a responsive two-column grid by default. Fields that omit
  `settingsColumnSpan` take the full section width, while fields that set `settingsColumnSpan: 1`
  share a row on medium+ viewports.
- Widget settings should keep a flat visual hierarchy. Shared settings sections may use one outer
  section card, but individual fields inside that section should not introduce another nested card
  layer unless the control genuinely needs its own independent surface.
- Shared widget metadata and chrome controls should show explicit key/value language in the UI.
  Avoid unlabeled pills for persisted settings such as widget kind, placement, surface mode, or
  header visibility.
- Dense widget settings should reuse the shared classes from `form-density.ts` instead of hand-rolling one-off compact control styles.
- Widget settings fields should expose `(i)` help through `widget-setting-help.tsx` when the field
  is not self-explanatory, especially for persisted props, binding-dependent controls, formatting
  behavior, and controls with validation constraints.
- Host surfaces should treat widget settings as a dedicated view or panel, not a narrow modal. The shared settings UI is intentionally layout-agnostic so workspace-style surfaces can give schema-heavy widgets a full-width editing experience.
- The settings trigger should only be treated as the affordance for configurable widget instances. Preconfigured app-owned instances may choose to hide or lock that affordance at the surface level.
- Header actions belong in the shared widget chrome when the control should live beside title/settings instead of consuming space inside the widget body.
- Workspace-style surfaces can reuse the shared duplicate trigger so every widget instance exposes the same copy affordance instead of implementing per-widget duplication controls.
- Workspace edit surfaces should keep generic widget chrome actions compact. In the studio canvas,
  guide/settings/duplicate/remove are now grouped under one overflow menu instead of rendering as
  four separate header buttons on every widget card.
- Shared widget headers should stay visually tight. Title bars, badges, explorer/settings triggers,
  and edit-mode menu affordances are expected to minimize vertical padding so chrome does not eat
  meaningful canvas space.
- Widget instances can hide their header in normal viewing through the shared `showHeader` chrome setting, while workspace edit mode forces the header visible so drag/settings controls stay available.
- Widget instances can also choose a shared `surfaceMode` in presentation state. `default` keeps the normal card shell, while `transparent` removes the card fill/shadow so the widget sits flatter on the workspace canvas.
- Widget instances can also choose a shared `placementMode` in presentation state. `canvas` keeps
  the normal mounted card in the dashboard grid, while `sidebar` keeps the widget mounted for
  runtime/state publication but hides its card from the workspace canvas so it lives only in the
  workspace edit rail.
- Canvas companion fields from `presentation.exposedFields` remain independent from card
  placement. A sidebar-only widget can still project selected schema fields onto the canvas as
  companion cards while the owning widget instance stays in the edit rail.
- Workspace-style canvases may choose to render exposed companion fields as first-class layout
  items instead of floating overlays. Visibility/exposure still comes from shared presentation
  state, but committed companion-card placement now belongs to the dashboard model. The optional
  `gridX/gridY/gridW/gridH` presentation fields remain only as a backward-compatible migration
  fallback for older stored workspaces.
- Companion-field hosts should only create a canvas wrapper when at least one field is actually visible. Sidebar-only widgets with no exposed canvas fields must not leave behind empty grid items or invisible hit areas.
- Widget definitions can optionally provide `workspaceIcon` and `railSummaryComponent` so
  workspace-style surfaces can show meaningful per-widget icons and hover summaries without
  hardcoding widget-specific logic into the canvas host. The older `railIcon` field now exists
  only as a backward-compatible fallback for widget definitions that have not migrated yet.
- Widget definitions can also provide `defaultPresentation`. This is the shared way to make a widget start as `sidebar` or `canvas` by default, or to seed other presentation defaults, without hardcoding per-widget behavior in the dashboard hosts.
- Widget definitions can set `fixedPlacementMode` when a widget must always stay in one
  placement. The shared presentation resolver and settings panel enforce that placement even if a
  persisted instance has older presentation state.
- The shared widget frame does not inject default body padding. Widget authors own internal spacing inside the widget implementation.
- Missing-widget placeholders explain that the current client does not recognize the stored widget id. Customizable surfaces may attach a direct delete action so stale legacy instances can be removed.
- Themes should target widget containers through the shared widget-shell markers from `chrome.ts` instead of hardcoding selectors against individual widget implementations.
- Theme-specific card treatments should respect the shared widget surface contract. In particular, shells marked as transparent or otherwise borderless should not receive theme-added inner borders or pseudo-element frames that only make sense for normal card surfaces.

## Maintenance notes

- Keep widget chrome behavior consistent between surfaces of the same kind, but distinguish clearly between preconfigured/read-only widget instances and customizable workspace instances.
- Reuse the shared settings trigger and panel instead of duplicating widget header actions in feature pages.
