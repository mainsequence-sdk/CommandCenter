# Workspace Row Widget

This widget is a workspace layout primitive modeled after collapsible dashboard rows rather than a normal content panel.

## Purpose

- Renders a full-width row header inside the main workspace grid.
- Groups the following sibling widgets until the next row.
- Collapses by serializing those child widgets into `row.children` on the row instance.
- Expands by restoring the serialized child widgets back into the top-level dashboard widget list.

## Entry Points

- `definition.ts`: widget metadata and registry definition.
- `WorkspaceRowCard.tsx`: shared row-header visual shell reused by both the widget body and the studio canvas host.
- `WorkspaceRowWidget.tsx`: passive row header rendering used outside the studio host-specific row shell.
- `WorkspaceRowWidgetSettings.tsx`: row accent-color settings and behavior notes.

## Maintenance Notes

- Row structure is owned by the dashboard model, not by generic widget props.
- Collapsed child widgets are stored in `DashboardWidgetInstance.row.children`.
- Rows stay full width and fixed height through the dashboard layout helpers and the RGL adapter.
- In the workspace studio, collapse/expand is controlled from the row header on the canvas.
- The studio and the passive widget body now share the same row chrome through `WorkspaceRowCard.tsx`; do not fork a second row-only visual shell in the canvas host.
- Rows remain full-width and fixed-height, but they are draggable from the row header in both collapsed and expanded states.
- `color` optionally tints the row header accent; when omitted, the row uses the current theme color.
