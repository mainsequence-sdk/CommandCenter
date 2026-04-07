# Markdown Note Widget

This widget renders Markdown-authored narrative content inside dashboards and workspaces.

## Purpose

- Show runbooks, operator notes, market context, or lightweight documentation beside live widgets.
- Reuse the shared Markdown renderer so typography, code blocks, links, and tables match the rest of
  the app.
- Keep content instance-scoped so saved workspaces and dashboard duplication preserve the note text.

## Entry Points

- `definition.ts`: widget metadata, catalog registration details, and default example props.
- `MarkdownNoteWidget.tsx`: runtime renderer for Markdown content and the empty state.
- `MarkdownNoteWidgetSettings.tsx`: Markdown-specific controls that plug into the shared widget
  settings panel.

## Maintenance Notes

- Keep the widget on the shared `MarkdownContent` renderer instead of introducing a second Markdown
  stack.
- Keep props JSON-serializable so existing dashboard persistence flows continue to work without extra
  adapters.
- Raw HTML is now allowed only through the shared `MarkdownContent` sanitizer allowlist for a small
  subset of tags and attributes needed for authored content such as tables, images, headings, and
  links. Keep the schema tight and do not widen it casually.
