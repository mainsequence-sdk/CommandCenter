## buildPurpose

Markdown-rendered workspace note for narrative text and runbooks.

## whenToUse

- Use when the content is static authored documentation or commentary.
- Use when downstream prompt-driven widgets should reuse the authored Markdown source as plain text.

## whenNotToUse

- Do not use when the content should come from structured upstream data or execution outputs.

## authoringSteps

- Add the widget and write the Markdown body.
- Adjust width, vertical alignment, and link behavior if needed.
- In workspace graph mode, use the Markdown button on the graph node header to open the rendered
  note and edit the saved Markdown content directly from the attached side card.
- Bind `Markdown content` when another widget should consume the authored source text directly.

## inboundPorts

- None.

## outboundPorts

- `markdown-content` / `Markdown content`
  - Contract: `core.value.string@v1`
  - Publishes the raw authored Markdown source stored in the widget.
- Platform-generated `agent-context`
  - Contract: `core.widget-agent-context@v1`
  - Publishes a compact agent-facing snapshot derived from the rendered note.

## commonPitfalls

- Large operational datasets should not be embedded as Markdown tables when a data widget exists.
- `Markdown content` publishes the authored Markdown source, not rendered HTML.
- The graph-mode side card edits the same saved `content` prop as widget settings. It is not a
  separate graph-only note copy.
