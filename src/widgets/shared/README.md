# Widget Shared UI

This directory contains reusable widget presentation primitives that are shared across dashboard surfaces.

## Main entry points

- `widget-frame.tsx`: standard card shell for registered widget instances, including the header chrome, optional widget-defined header actions, and state placeholders.
- `chrome.ts`: shared helpers for widget chrome options such as per-instance header visibility, plus shared widget-shell markers used by themes to style widget containers consistently.
- `widget-settings.tsx`: shared settings trigger and modal that expose per-instance title and props editing, while rendering widget-specific settings UIs directly without an extra generic wrapper section.

## Notable behavior

- Settings are intentionally instance-scoped: the modal edits the current dashboard widget instance, not the underlying widget definition.
- The settings modal is generic by default and can be extended per widget through `WidgetDefinition.settingsComponent`.
- The shared modal closes through explicit dismiss actions or Escape; it does not dismiss on outside click by default.
- The settings trigger should only be treated as the affordance for configurable widget instances. Preconfigured app-owned instances may choose to hide or lock that affordance at the surface level.
- Header actions belong in the shared widget chrome when the control should live beside title/settings instead of consuming space inside the widget body.
- Widget instances can hide their header in normal viewing through the shared `showHeader` chrome setting, while workspace edit mode forces the header visible so drag/settings controls stay available.
- The shared widget frame does not inject default body padding. Widget authors own internal spacing inside the widget implementation.
- Themes should target widget containers through the shared widget-shell markers from `chrome.ts` instead of hardcoding selectors against individual widget implementations.

## Maintenance notes

- Keep widget chrome behavior consistent between surfaces of the same kind, but distinguish clearly between preconfigured/read-only widget instances and customizable workspace instances.
- Reuse the shared settings trigger and modal instead of duplicating widget header actions in feature pages.
