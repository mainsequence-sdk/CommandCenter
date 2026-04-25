# Debug Stream Widget

This folder owns the core `debug_stream` widget. It is a consumer-only debugging surface for
workspace dataset bindings.

## Entry Points

- `definition.ts`: widget definition, IO metadata, registry contract, demo data, and registration wiring.
- `DebugStreamWidget.tsx`: runtime panel that resolves the bound source, logs a compact debug snapshot, renders the explorer-style preview, and shows binding/runtime summaries.
- `DebugStreamWidgetSettings.tsx`: lightweight settings guidance telling authors to use bindings and showing the currently resolved input state.
- `USAGE_GUIDANCE.md`: registry-synced user-facing guidance.

## Behavior

- The widget accepts one inbound `sourceData` binding with `core.tabular_frame@v1`.
- It uses the same `useResolvedTabularWidgetSourceBinding(...)` resolution path as consumer widgets
  such as Graph and Table, so it surfaces the same upstream visibility problems instead of bypassing
  them.
- It calls `useResolveWidgetUpstream(...)` when the source is bound but still unresolved, making it
  suitable for tracing the live consumer path.
- It renders the resolved source through `ConnectionQueryResponsePreview`, which means canonical
  tabular data shows as a compact table and tabular data with `meta.timeSeries` hints shows as a
  graph-first preview.
- In development mode it emits a `[debug-stream] snapshot` console log summarizing binding status,
  source widget metadata, resolved frame type, and whether upstream resolution is still pending.

## Maintenance Constraints

- Keep this widget consumer-only. It should not own backend execution or publish a new dataset.
- Keep accepted contracts aligned with `core.tabular_frame@v1`.
- Prefer compact summaries over dumping full runtime frames into console logs.
- When consumer binding semantics change, keep the snapshot fields in this widget aligned with the
  upstream resolver path so it remains a trustworthy debugging surface.
