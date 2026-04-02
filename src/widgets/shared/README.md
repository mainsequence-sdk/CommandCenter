# Widget Shared UI

This directory contains reusable widget presentation primitives that are shared across dashboard surfaces.

## Main entry points

- `widget-frame.tsx`: standard card shell for registered widget instances, including the header chrome, optional widget-defined header actions, and state placeholders.
- `chrome.ts`: shared helpers for widget chrome options such as per-instance header visibility, plus shared widget-shell markers used by themes to style widget containers consistently.
- `widget-settings.tsx`: shared settings trigger plus the reusable full-page settings panel used to edit widget instances outside the old modal flow. It also exports the shared duplicate trigger used by workspace widget chrome.
- `WidgetSourceExplorer.tsx`: reusable source widget/source output explorer used by binding UIs. It keeps bindings port-to-port while layering nested value exploration, transform selection, compatibility messaging, and preview on top of structured output descriptors.
- `widget-schema.ts`: shared helpers for widget schema visibility, controller context resolution, and exposed-field presentation state.
- `widget-schema-form.tsx`: generic settings form renderer for schema-based widget fields. The form
  now supports per-field layout width through `WidgetFieldDefinition.settingsColumnSpan`, so shared
  schemas can place small controls side by side instead of forcing every field onto its own row.
- `widget-canvas-controls.tsx`: host for schema fields that are exposed as external companion cards beside a widget instance. The workspace studio still uses it to edit exposed-field state, while the shared dashboard viewer now renders companion fields through the dashboard canvas-item/runtime layout path instead of widget-local overlays.
- `form-density.ts`: shared spacing and control-density classes for widget settings forms that need a tighter configuration surface.
  It also exposes reusable compact table-density classes for settings previews.

## Notable behavior

- Settings are intentionally instance-scoped: the shared panel edits the current dashboard widget instance, not the underlying widget definition.
- The shared settings panel is generic by default and can be extended per widget through `WidgetDefinition.schema`, `WidgetDefinition.controller`, and `WidgetDefinition.settingsComponent`.
- Structured output exploration belongs in the shared source explorer contract, not in widget-specific binding hacks. Widgets should expose `valueDescriptor` metadata on outputs, and shared binding surfaces should consume that metadata to render nested-field exploration consistently.
- Widget definitions can also set `showRawPropsEditor: false` when the shared raw JSON props editor should stay hidden and the widget should be configured only through structured settings controls.
- The shared settings panel can also expose an optional remove action from the host surface. This is important for sidebar-only widgets, because they may not have an on-canvas card chrome with a delete button.
- Schema-backed fields can optionally be exposed on the canvas through instance-level presentation state as companion cards outside the widget frame instead of being trapped inside the widget settings page.
- Schema sections render as a responsive two-column grid by default. Fields that omit
  `settingsColumnSpan` take the full section width, while fields that set `settingsColumnSpan: 1`
  share a row on medium+ viewports.
- Dense widget settings should reuse the shared classes from `form-density.ts` instead of hand-rolling one-off compact control styles.
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
- Widget definitions can optionally provide `railIcon` and `railSummaryComponent` so workspace-style
  surfaces can show meaningful per-widget icons and hover summaries in the shared edit rail without
  hardcoding widget-specific logic into the canvas host.
- Widget definitions can also provide `defaultPresentation`. This is the shared way to make a widget start as `sidebar` or `canvas` by default, or to seed other presentation defaults, without hardcoding per-widget behavior in the dashboard hosts.
- The shared widget frame does not inject default body padding. Widget authors own internal spacing inside the widget implementation.
- Missing-widget placeholders explain that the current client does not recognize the stored widget id. Customizable surfaces may attach a direct delete action so stale legacy instances can be removed.
- Themes should target widget containers through the shared widget-shell markers from `chrome.ts` instead of hardcoding selectors against individual widget implementations.
- Theme-specific card treatments should respect the shared widget surface contract. In particular, shells marked as transparent or otherwise borderless should not receive theme-added inner borders or pseudo-element frames that only make sense for normal card surfaces.

## Maintenance notes

- Keep widget chrome behavior consistent between surfaces of the same kind, but distinguish clearly between preconfigured/read-only widget instances and customizable workspace instances.
- Reuse the shared settings trigger and panel instead of duplicating widget header actions in feature pages.
