## buildPurpose

Inline rich-text workspace note with direct canvas editing.

## whenToUse

- Use when non-technical users should edit narrative card content directly on the workspace.
- Use when the note should be authored as WYSIWYG rich text instead of raw markdown.

## whenNotToUse

- Do not use when markdown source fidelity matters.
- Do not use when the content should come from structured upstream data or execution outputs.

## authoringSteps

- Add the widget to a workspace.
- Enter workspace edit mode and write directly on the card.
- Right-click the note to open the compact floating inline toolbar for unified text style,
  emphasis, lists, quotes, code, links, horizontal alignment, and vertical placement.
- Adjust width, paragraph spacing, horizontal alignment, vertical placement, or link behavior in
  settings if needed. Paragraph spacing uses direct numeric values such as `1`, `1.5`, or `2`
  and applies them as `rem` spacing between paragraphs and list blocks.
- The widget hides the shared card header by default so the content reads like a slide or document
  block instead of a utility widget.

## commonPitfalls

- This widget stores HTML, not markdown.
- Inline editing depends on host support for canvas editing.
- The formatting toolbar opens on right-click in edit mode. It is intentionally positioned above
  the note surface instead of inside the card header area.
- Alignment and paragraph-spacing settings affect the rendered layout around the HTML content; they
  do not rewrite the stored HTML itself. Paragraph spacing is a numeric `rem` value, not a named
  preset.
