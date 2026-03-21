# Workspace Row Widget

This widget is a workspace layout primitive rather than a content widget.

## Purpose

- Renders a horizontal divider inside a workspace canvas.
- Splits the canvas into vertical bands so normal widgets stay fully above or below the divider.
- Acts as a structural marker for the workspace layout resolver and editor geometry logic.

## Entry Points

- `definition.ts`: widget metadata and registry definition.
- `WorkspaceRowWidget.tsx`: visual divider rendering for runtime and preview contexts.

## Maintenance Notes

- The divider behavior is enforced in the dashboard layout helpers, not in the render component.
- Width and height are intentionally fixed by the workspace geometry logic.
- This widget should keep `showHeader: false` by default.
- `visible` defaults to `false`, so the row behaves as a structural separator and is only discoverable in edit mode until explicitly shown.
- `color` optionally overrides the divider tint; when omitted, the row uses the current theme color.
