# Main Sequence Data Node Visualizer Widget

This widget turns Main Sequence data-node table data into configurable chart or table views.

## Files

- `definition.ts`: widget metadata and registration payload.
- `MainSequenceDataNodeVisualizerWidget.tsx`: widget shell that resolves configuration, chooses either the dashboard date or a fixed widget date, fetches remote table data, and renders chart/table modes.
- `MainSequenceDataNodeVisualizerWidgetSettings.tsx`: typed widget settings form grouped into data node, date range, visualization, field mapping, preview, and series styling sections, using the shared Main Sequence picker UI.
- `TradingViewSeriesChart.tsx`: TradingView Lightweight Charts renderer for line, area, and bar visualizations.
- `DataNodeVisualizerTable.tsx`: table fallback for inspecting the fetched rows directly.
- `dataNodeVisualizerModel.ts`: shared configuration defaults, field-option inference, requested-column selection, and row-to-series transforms.

## Configuration model

- The widget definition is reusable, but each widget instance owns its own `dataNodeId`, date-range mode, axis selections, grouping, provider, chart type, and default view.
- Saved chart behavior also includes series normalization, an optional normalization anchor date, shared vs separate series axes, and per-series color overrides keyed by the resolved series id.
- App-owned surfaces can ship preconfigured instances.
- Dashboard and workspace builders can expose instance settings through the shared widget settings modal.

## Data flow

- Data-node options come from the existing `listDataNodes` endpoint using `light=true` so the widget settings rely on the faster serializer.
- The settings dropdown does not preload data nodes. It remote-searches with `q` plus `light=true` as the user types and exposes retry feedback if that search request fails.
- Data-node schema defaults are inferred from `sourcetableconfiguration`, especially `time_index_name`, `index_names`, `column_dtypes_map`, and `columns_metadata`.
- If a selected data node does not expose `sourcetableconfiguration`, the widget and settings surface it as a no-data state instead of showing empty field mappings.
- Settings range anchoring comes from `dynamic_table/{id}/get_last_observation/`, using the node's time index to seed a recent fixed-date window.
- Remote data is fetched from `dynamic_table/{id}/get_data_between_dates_from_remote/`.
- For a fixed node and time window, the widget fetches the available field set once and remaps chart axes, series normalization, and series colors locally so those changes do not trigger a new remote data request.
- Each widget instance can either follow the current dashboard date or persist its own fixed `start/end` date.
- The chart path is tolerant of Python-style datetime strings and can recover a usable X/Y pair from returned rows when metadata is incomplete.
- When a grouped line or area chart resolves to one point per series, the TradingView renderer enables point markers so sparse daily snapshots stay visible.

## Settings preview

- The settings modal fetches the selected node's latest observation and uses its time index as the default fixed-date end when needed.
- The preview anchors its request on the latest available row for the node and keeps the current range span, so stale datasets still render in settings.
- Visualization settings separate widget-level defaults, such as the default open view, from provider-specific renderer controls.
- The preview can switch locally between chart and table without changing the saved widget `displayMode`.
- Table preview requests all available fields so the preview grid shows the full row shape, not only the mapped chart columns.
- Fixed-date presets and inputs update the widget instance configuration directly.
- The previewed series list also drives the per-series color editors, so overrides stay aligned with the current grouping output.

## Defaults

- X axis defaults to `time_index_name` when available, otherwise the first time-like field or first indexed field.
- Grouping defaults to the second index field when present.
- Y axis defaults to the first non-index numeric field.
- Date range defaults to the dashboard date until the widget is switched to a fixed range.
- When normalization is enabled without an explicit anchor date, the chart rebases each series to the first visible date in the active range.
- Provider starts with TradingView Lightweight Charts, but the config model leaves room for additional providers later.
