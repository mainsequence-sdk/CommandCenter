# Main Sequence Data Node Graph Widget

This widget turns Main Sequence data-node table data into configurable charts, with a settings-only table preview for inspection.

## Files

- `definition.ts`: widget metadata and registration payload.
- `schema.tsx`: schema-driven field definitions for the graph-specific settings surface, composed on
  top of the shared data-node source/date-range schema from `../data-node-shared/`.
- `controller.ts`: graph-specific controller layer that builds axis/group options on top of the
  shared data-node source controller from `../data-node-shared/`.
- `MainSequenceDataNodeVisualizerWidget.tsx`: widget shell that resolves configuration, consumes the
  linked Data Node's canonical row dataset, and always renders the mounted chart.
- `MainSequenceDataNodeVisualizerWidgetSettings.tsx`: advanced settings panel for preview and
  series styling, rendered below the shared schema-driven settings form.
- `TradingViewSeriesChart.tsx`: TradingView Lightweight Charts renderer for line, area, and bar visualizations.
- `DataNodeVisualizerTable.tsx`: compatibility export for the shared settings preview table now
  owned by `../data-node-shared/DataNodePreviewTable.tsx`.
- `dataNodeVisualizerModel.ts`: graph-specific configuration defaults, mapped-field inference,
  requested-column selection, and row-to-series transforms.

## Configuration model

- The widget definition is reusable, but each chart instance now owns only chart mapping and display
  behavior such as axis selections, grouping, provider, chart type, normalization, and series
  styling.
- Source selection, identifier filtering, date range, and reusable row transforms now belong to a
  sibling `Data Node` widget in the same dashboard.
- Saved chart behavior also includes series normalization, an optional normalization anchor date, shared vs separate series axes, and per-series color overrides keyed by the resolved series id.
- App-owned surfaces can ship preconfigured instances.
- Dashboard and workspace builders can expose instance settings through the shared widget settings modal.

## Data flow

- Data-node options come from the dedicated `dynamic_table/quick-search/` endpoint, which returns lightweight `id / storage_hash / identifier` matches for the current query.
- The settings dropdown does not preload data nodes. It remote-searches as the user types, requires at least 3 characters before it queries the backend, and exposes retry feedback if that search request fails.
- The widget selects from sibling `Data Node` instances instead of running its own data-node
  picker.
- Data-node schema defaults are inferred from `sourcetableconfiguration`, especially `time_index_name`, `index_names`, `column_dtypes_map`, and `columns_metadata`.
- If a selected data node does not expose `sourcetableconfiguration`, the widget and settings surface it as a no-data state instead of showing empty field mappings.
- Settings range anchoring comes from `dynamic_table/{id}/get_last_observation/`, using the node's time index to seed a recent fixed-date window.
- Remote data is fetched by the `Data Node` from `dynamic_table/{id}/get_data_between_dates_from_remote/`.
- The live chart only reads mapped `x/y/group` fields from the linked Data Node dataset instead of owning
  its own backend query.
- For a fixed node and time window, the settings preview fetches the available field set once and remaps chart axes, series normalization, and series colors locally so those changes do not trigger a new remote data request.
- Each widget instance can either follow the current dashboard date or persist its own fixed `start/end` date.
- The chart path is tolerant of Python-style datetime strings and can recover a usable X/Y pair from returned rows when metadata is incomplete.
- When a grouped line or area chart resolves to one point per series, the TradingView renderer enables point markers so sparse daily snapshots stay visible.

## Settings preview

- Core configuration now comes from the shared source/date-range schema renderer plus the
  visualizer-specific schema sections, while preview and per-series color tuning stay in the
  widget-specific advanced settings panel.
- The settings modal fetches the selected node's latest observation and uses its time index as the default fixed-date end when needed.
- The preview anchors its request on the latest available row for the node and keeps the current range span, so stale datasets still render in settings.
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
