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
  compact floating edit toolbar opened explicitly with right-click.
- `RichTextNoteWidgetSettings.tsx`: secondary presentation controls and advanced HTML source view.

## Maintenance Notes

- This widget is intentionally separate from `Markdown`. It stores HTML as canonical content and is
  the rich-text-native authoring path.
- Inline editing depends on the shared widget canvas-editing capability plus host support in the
  workspace studio. Do not reintroduce widget-local host hacks here.
- The widget now uses a compact floating toolbar that opens on right-click during canvas edit mode.
  Keep the controls dense and local to the note instead of reintroducing a large full-width editor
  strip or a click-triggered menu.
- The toolbar should expose one coherent text-style model. Do not reintroduce separate competing
  dropdowns for heading style and inline text size.
- Presentation settings control both horizontal text alignment (`left`, `center`, `right`,
  `justify`), paragraph spacing as a numeric `rem` value, and vertical placement (`top`, `middle`,
  `bottom`) without changing the stored HTML.
- Those same high-frequency layout controls are also exposed in the inline edit toolbar. Keep
  inline controls limited to fast composition adjustments.
- Paragraph spacing intentionally stays in settings instead of the floating toolbar so the inline
  menu stays compact and focused on composition.
- New Rich Text widgets default to `showHeader: false` so authored content reads like a document
  surface by default. Keep that behavior unless a product surface explicitly needs utility-card
  chrome.
- The inline menu includes constrained font-size tokens from `Small` through `4XL`. Keep the size
  scale tokenized and predictable instead of introducing arbitrary pixel input.
- The inline toolbar should render above the note, outside the card chrome, whenever viewport space
  allows. Do not anchor it inside the note header area where it collides with card titles.
- Keep the toolbar scope practical. This widget is for rich note authoring, not full document
  layout design.
- Keep props JSON-serializable so workspace drafts, saved widgets, and snapshots continue to
  round-trip cleanly.
