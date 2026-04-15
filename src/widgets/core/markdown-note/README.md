# Markdown Note Widget

This widget renders Markdown-authored narrative content inside dashboards and workspaces.

## Purpose

- Show runbooks, operator notes, market context, or lightweight documentation beside live widgets.
- Reuse the shared Markdown renderer so typography, code blocks, links, and tables match the rest of
  the app.
- Keep content instance-scoped so saved workspaces and dashboard duplication preserve the note text.
- Let authors control both content width and vertical placement inside the widget card when the
  note is shorter than the available card height.

## Entry Points

- `definition.ts`: widget metadata, catalog registration details, and default example props.
- `MarkdownNoteWidget.tsx`: runtime renderer for Markdown content, empty state, and vertical
  content alignment.
- `MarkdownNoteWidgetSettings.tsx`: Markdown-specific controls that plug into the shared widget
  settings panel.

## Maintenance Notes

- `definition.ts` now publishes `widgetVersion` plus an explicit `registryContract`. Keep the
  agent-facing description aligned with the actual authored Markdown settings surface.
- `Markdown Note` now also publishes the platform-generated `agent-context` output because it
  implements `buildAgentSnapshot(...)`. That makes authored notes bindable as compact agent-facing
  context for widgets such as `Agent Terminal`.
- Keep the widget on the shared `MarkdownContent` renderer instead of introducing a second Markdown
  stack.
- Keep props JSON-serializable so existing dashboard persistence flows continue to work without extra
  adapters.
- Vertical alignment now applies to the rendered Markdown body, not only the empty state. Preserve
  normal overflow scrolling when content is taller than the card height.
- Raw HTML is now allowed only through the shared `MarkdownContent` sanitizer allowlist for a small
  subset of tags and attributes needed for authored content such as tables, images, headings, and
  links. Keep the schema tight and do not widen it casually.
