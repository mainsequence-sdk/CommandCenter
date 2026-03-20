# Widgets

This directory contains the Command Center widget platform, including the shared widget contract, built-in widgets, extension-owned widgets, and reusable presentation primitives.

## Main entry points

- `types.ts`: shared widget definition contract, widget render props, and the optional settings component contract.
- `shared/widget-frame.tsx`: common widget chrome used by dashboard surfaces.
- `shared/widget-settings.tsx`: shared settings trigger and modal used by dashboard widgets and the custom workspace studio.
- `core/`: built-in widgets shipped with the core extension.
- `extensions/`: optional widget implementations used by example or third-party extensions.

## Notable behavior

- A `WidgetDefinition` is the reusable widget type: metadata, render component, and optional typed settings UI.
- A dashboard or app mounts widget instances. Each instance has its own `title` and `props`.
- Widget settings are instance-scoped, not global to the widget definition. Two surfaces can use the same widget definition with different props.
- App-owned surfaces can use preconfigured widget instances so users consume the widget without needing to configure it.
- Custom dashboard and workspace flows are the place where instance settings are intended to be user-editable.
- The shared settings modal supports title overrides and raw JSON prop editing for any widget instance.
- Static dashboard surfaces currently keep widget settings changes only for the current page session.
- The custom workspace studio writes widget settings into the workspace draft, and those changes persist once the user saves the workspace.

## Maintenance notes

- Prefer wiring new widget-level configuration through the shared settings modal before adding page-specific controls.
- If a widget needs a richer configuration experience, provide `settingsComponent` on its `WidgetDefinition` instead of forking the modal shell.
- Be explicit about whether a surface is rendering a preconfigured widget instance or a user-configurable widget instance.
- Keep widget module documentation close to the implementation when adding new widget folders.
