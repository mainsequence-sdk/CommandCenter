# Rich Text Widget

This widget renders and edits rich text notes directly on the workspace canvas.

## Purpose

- Give users a friendly WYSIWYG note card instead of forcing raw markdown/source editing.
- Support inline canvas authoring during workspace edit mode.
- Keep narrative content local to the widget instance so workspace persistence and duplication work
  without extra backend plumbing.

## Entry Points

- `definition.ts`: widget metadata, inline-canvas-editing capability, registry contract, and
  example props.
- `RichTextNoteWidget.tsx`: runtime renderer plus TipTap-based inline editing surface.
- `RichTextNoteWidgetSettings.tsx`: secondary presentation controls and advanced HTML source view.

## Maintenance Notes

- This widget is intentionally separate from `Markdown`. It stores HTML as canonical content and is
  the rich-text-native authoring path.
- Inline editing depends on the shared widget canvas-editing capability plus host support in the
  workspace studio. Do not reintroduce widget-local host hacks here.
- The inline toolbar includes constrained font-size tokens from `Small` through `4XL`. Keep the
  size scale tokenized and predictable instead of introducing arbitrary pixel input.
- Keep the toolbar scope practical. This widget is for rich note authoring, not full document
  layout design.
- Keep props JSON-serializable so workspace drafts, saved widgets, and snapshots continue to
  round-trip cleanly.
