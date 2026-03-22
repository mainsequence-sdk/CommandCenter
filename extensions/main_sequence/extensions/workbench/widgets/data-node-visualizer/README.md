# Main Sequence Data Node Graph Widget

This widget turns Main Sequence data-node table data into configurable charts, with a settings-only table preview for inspection.

## Files

- `definition.ts`: widget metadata and registration payload.
- `schema.tsx`: schema-driven field definitions for the primary settings form, including the
  poppable `dataNodeId` selector and the default-on-canvas `uniqueIdentifierList` field.
- `controller.ts`: shared controller layer that normalizes props, resolves data-node metadata, and
  provides field option/context data to both settings and canvas-exposed controls.
- `MainSequenceDataNodeVisualizerWidget.tsx`: widget shell that resolves configuration, chooses either the dashboard date or a fixed widget date, fetches only the mapped live fields, and always renders the mounted chart.
- `MainSequenceDataNodeVisualizerWidgetSettings.tsx`: advanced settings panel for preview and
  series styling, rendered below the shared schema-driven settings form.
- `TradingViewSeriesChart.tsx`: TradingView Lightweight Charts renderer for line, area, and bar visualizations.
- `DataNodeVisualizerTable.tsx`: table fallback for inspecting the fetched rows directly.
- `dataNodeVisualizerModel.ts`: shared configuration defaults, field-option inference, requested-column selection, and row-to-series transforms.

## Configuration model

- The widget definition is reusable, but each widget instance owns its own `dataNodeId`, date-range mode, axis selections, grouping, provider, and chart type.
- When a selected data node uses `["time_index", "unique_identifier"]` as its leading indexes, the widget instance can also persist a `uniqueIdentifierList` filter.
- The `dataNodeId` selector can be exposed as an external companion card on the canvas for dynamic
  chart switching.
- The `uniqueIdentifierList` field is exposed on the canvas by default as its own companion card
  so a workspace can expose identifier filtering without reopening settings.
- Saved chart behavior also includes series normalization, an optional normalization anchor date, shared vs separate series axes, and per-series color overrides keyed by the resolved series id.
- App-owned surfaces can ship preconfigured instances.
- Dashboard and workspace builders can expose instance settings through the shared widget settings modal.

## Data flow

- Data-node options come from the dedicated `dynamic_table/quick-search/` endpoint, which returns lightweight `id / storage_hash / identifier` matches for the current query.
- The settings dropdown does not preload data nodes. It remote-searches as the user types, requires at least 3 characters before it queries the backend, and exposes retry feedback if that search request fails.
- Data-node schema defaults are inferred from `sourcetableconfiguration`, especially `time_index_name`, `index_names`, `column_dtypes_map`, and `columns_metadata`.
- If the second index is `unique_identifier`, the widget settings expose an enter-to-add identifier pill editor and send the applied values as `unique_identifier_list` in the remote data request.
- If a selected data node does not expose `sourcetableconfiguration`, the widget and settings surface it as a no-data state instead of showing empty field mappings.
- Settings range anchoring comes from `dynamic_table/{id}/get_last_observation/`, using the node's time index to seed a recent fixed-date window.
- Remote data is fetched from `dynamic_table/{id}/get_data_between_dates_from_remote/`.
- The live widget request only includes the mapped `x/y/group` fields plus any identifier filter, instead of asking the backend for the full schema.
- For a fixed node and time window, the settings preview fetches the available field set once and remaps chart axes, series normalization, and series colors locally so those changes do not trigger a new remote data request.
- Each widget instance can either follow the current dashboard date or persist its own fixed `start/end` date.
- The chart path is tolerant of Python-style datetime strings and can recover a usable X/Y pair from returned rows when metadata is incomplete.
- When a grouped line or area chart resolves to one point per series, the TradingView renderer enables point markers so sparse daily snapshots stay visible.

## Settings preview

- Core configuration now comes from the shared schema renderer, while preview and per-series color
  tuning stay in the widget-specific advanced settings panel.
- The settings modal fetches the selected node's latest observation and uses its time index as the default fixed-date end when needed.
- The preview anchors its request on the latest available row for the node and keeps the current range span, so stale datasets still render in settings.
- Identifier edits now update the widget draft directly and flow into the preview query immediately.
- Visualization settings focus on the mounted chart renderer and provider-specific controls.
- The preview can switch locally between chart and table without changing the live widget surface.
- Table preview requests all available fields so the preview grid shows the full row shape, not only the mapped chart columns.
- Fixed-date presets and inputs update the widget instance configuration directly.
- The previewed series list also drives the per-series color editors, so overrides stay aligned with the current grouping output.
- In the mounted widget, the visualizer always stays on the chart so the table remains a settings-only inspection tool.
- The mounted chart now sizes directly to the available widget body, so dashboard resizing should shrink the visualizer instead of cropping it behind hardcoded chart minimums.

## Defaults

- X axis defaults to `time_index_name` when available, otherwise the first time-like field or first indexed field.
- Grouping defaults to the second index field when present.
- Y axis defaults to the first non-index numeric field.
- Date range defaults to the dashboard date until the widget is switched to a fixed range.
- When normalization is enabled without an explicit anchor date, the chart rebases each series to the first visible date in the active range.
- Provider starts with TradingView Lightweight Charts, but the config model leaves room for additional providers later.
