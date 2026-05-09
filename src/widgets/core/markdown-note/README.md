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
- Graph mode now also exposes a Markdown-specific attached side-card action from the workspace
  dependency node, letting users inspect rendered Markdown and edit the saved note content without
  leaving the graph canvas.

## Maintenance Notes

- `definition.ts` now publishes `widgetVersion` plus an explicit `registryContract`. Keep the
  agent-facing description aligned with the actual authored Markdown settings surface.
- `Markdown Note` now publishes a typed `Markdown content` output with
  `core.value.string@v1`. Keep that output wired to the raw authored Markdown source so prompt
  consumers such as `Agent Terminal` receive the exact saved text rather than rendered HTML.
- The graph-mode attached side-card editor writes back through the normal workspace widget settings
  mutation path. Keep it editing the same saved `content` prop as widget settings instead of
  introducing a graph-only draft store.
- `Markdown Note` now also publishes the platform-generated `agent-context` output because it
  implements `buildAgentSnapshot(...)`. That makes authored notes bindable as compact agent-facing
  context for widgets such as `Agent Terminal`.
- Keep the widget on the shared `MarkdownContent` renderer instead of introducing a second Markdown
  stack.
- Markdown remains markdown-first. Friendly inline WYSIWYG canvas editing belongs to the separate
  `Rich Text` widget instead of this widget.
- Keep props JSON-serializable so existing dashboard persistence flows continue to work without extra
  adapters.
- Vertical alignment now applies to the rendered Markdown body, not only the empty state. Preserve
  normal overflow scrolling when content is taller than the card height.
- Raw HTML is now allowed only through the shared `MarkdownContent` sanitizer allowlist for a small
  subset of tags and attributes needed for authored content such as tables, images, headings, and
  links. Keep the schema tight and do not widen it casually.
