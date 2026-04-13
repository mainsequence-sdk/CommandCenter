# Main Sequence AI Upstream Inspector Widget

This folder owns the `main-sequence-ai-upstream-inspector` widget.

## Entry Points

- `definition.ts`: widget registry definition and stable widget id.
- `UpstreamInspectorWidget.tsx`: sink/debug widget that renders a bound upstream value as Markdown
  or raw text.
- `UpstreamInspectorWidgetSettings.tsx`: lightweight settings form for display mode and fallback
  content when no upstream binding is attached.

## Behavior Notes

- The widget is intended as a quick test sink for widget bindings, especially Agent Terminal output.
- It exposes one bindable input, `Upstream value`.
- Bound values take precedence over fallback content stored in widget props.
- String inputs can render as Markdown. Non-string inputs are rendered as raw text.
- Invalid binding states are shown inline so the widget can be used to debug binding issues.

## Maintenance Notes

- Keep the input contract list aligned with the values you want to inspect from agent-monitor
  workflows. If you widen accepted contracts later, make sure the renderer still formats them
  clearly.
- `definition.ts` now publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`.
- Keep that registry contract aligned with the real consumer behavior here: accepted upstream input
  contracts, fallback-content behavior, and Markdown vs raw-text rendering semantics.
- Bump `widgetVersion` when accepted inputs, rendering behavior, or agent-facing authoring guidance
  changes materially.
