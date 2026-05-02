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
- `RichTextNoteWidget.tsx`: runtime renderer plus TipTap-based inline editing surface with a
  compact floating focus-scoped edit toolbar.
- `RichTextNoteWidgetSettings.tsx`: secondary presentation controls and advanced HTML source view.

## Maintenance Notes

- This widget is intentionally separate from `Markdown`. It stores HTML as canonical content and is
  the rich-text-native authoring path.
- Inline editing depends on the shared widget canvas-editing capability plus host support in the
  workspace studio. Do not reintroduce widget-local host hacks here.
- The widget now uses a compact floating toolbar that appears only while the note is focused during
  canvas edit mode. Keep the controls dense and local to the note instead of reintroducing a large
  full-width editor strip.
- The toolbar should expose one coherent text-style model. Do not reintroduce separate competing
  dropdowns for heading style and inline text size.
- Presentation settings control both horizontal text alignment (`left`, `center`, `right`,
  `justify`) and vertical placement (`top`, `middle`, `bottom`) without changing the stored HTML.
- Those same high-frequency layout controls are also exposed in the inline edit toolbar while the
  note is focused. Keep inline controls limited to fast composition adjustments.
- New Rich Text widgets default to `showHeader: false` so authored content reads like a document
  surface by default. Keep that behavior unless a product surface explicitly needs utility-card
  chrome.
- The inline menu includes constrained font-size tokens from `Small` through `4XL`. Keep the size
  scale tokenized and predictable instead of introducing arbitrary pixel input.
- Keep the toolbar scope practical. This widget is for rich note authoring, not full document
  layout design.
- Keep props JSON-serializable so workspace drafts, saved widgets, and snapshots continue to
  round-trip cleanly.
