# Main Sequence Data Node Graph Widget

This widget turns Main Sequence data-node table data into configurable charts, with a settings-only table preview for inspection.

## Files

- `definition.ts`: widget metadata and registration payload.
- `schema.tsx`: schema-driven field definitions for the graph-specific settings surface, composed on
  top of the shared data-node source/date-range schema from `../data-node-shared/`.
- `controller.ts`: graph-specific controller layer that builds axis/group options on top of the
  shared data-node source controller from `../data-node-shared/`.
- `MainSequenceDataNodeVisualizerWidget.tsx`: widget shell that resolves configuration, consumes the
  linked Data Node's canonical row dataset, sanitizes second-level chart collisions, and renders
  the mounted chart with widget-local fallback messaging.
- `MainSequenceDataNodeVisualizerWidgetSettings.tsx`: advanced settings panel for preview and
  series styling, rendered below the shared schema-driven settings form. It also includes a
  modal-driven source-schema inspector so chart field typing is visible instead of implicit.
- `EChartsSeriesChart.tsx`: ECharts renderer for line, area, and bar visualizations using the same
  resolved chart-series contract as TradingView.
- `TradingViewSeriesChart.tsx`: TradingView Lightweight Charts renderer for line, area, and bar
  visualizations, with an internal fallback when the chart library rejects a dataset.
- `DataNodeVisualizerChartErrorBoundary.tsx`: local boundary that prevents chart failures from
  crashing the whole route.
- `DataNodeVisualizerTable.tsx`: compatibility export for the shared settings preview table now
  owned by `../data-node-shared/DataNodePreviewTable.tsx`.
- `dataNodeVisualizerModel.ts`: graph-specific configuration defaults, mapped-field inference,
  requested-column selection, and row-to-series transforms.

## Configuration model

- The widget definition is reusable, but each chart instance now owns only chart mapping and display
  behavior such as axis selections, grouping, provider, chart type, normalization, and series
  styling.
- Provider is now a real per-widget choice. `TradingView` uses Lightweight Charts, and `ECharts`
  uses the local ECharts renderer.
- Series stroke styling is per-series through `seriesOverrides`. For TradingView-backed line and
  area charts, each resolved series can now choose its own built-in line style (`Solid`,
  `Dotted`, `Dashed`, `Large dashed`, `Sparse dotted`) alongside its per-series color override.
- Time-axis interpretation is also per-widget. Each chart can force `Date`, force `DateTime`, or
  leave the mode on `Auto`, which infers the behavior from the bound X-field values.
- X-axis density is also per-widget through `minBarSpacingPx`. This is a TradingView-only
  time-scale control that determines how tightly long histories can compress into the initial
  viewport. Lower values allow the chart to fit longer series instead of opening on the most
  recent tail.
- Group visibility is also chart-local: the chart can include or exclude specific group values from
  the incoming Data Node dataset without changing the upstream canonical rows.
- The graph consumes the shared Data Node published dataset contract:
  `status`, `dataNodeId`, `columns: string[]`, and `rows: Record<string, unknown>[]`. It then
  derives chart series locally from that standard table-shaped input.
- The chart model is row-first: it expects long-form rows that can be mapped into
  `xField` + `yField` + optional `groupField`. When upstream data arrives wide, use a sibling
  `Data Node` widget's `Unpivot` transform to publish a long-form dataset before it reaches the
  graph.
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
- When that linked dataset is already published by an upstream `Data Node`, the mounted runtime
  visualizer also skips its own `dynamic_table/{id}/` detail lookup and resolves field mappings
  from the canonical published frame instead.
- If the linked `Data Node` is itself backed by an executable upstream source such as `AppComponent`,
  the visualizer now relies on the shared dashboard upstream-resolution path instead of requiring a
  direct executable source itself.
- Before rendering, chart series are normalized to chart-second precision so multiple rows that land
  in the same second collapse deterministically to the latest point instead of crashing the chart
  renderer. In `Date` axis mode, the same safeguard collapses duplicate points per UTC day instead
  of per second.
- Group include/exclude filtering happens after the chart resolves long-format rows from the linked
  Data Node, so multiple charts can render different subsets from the same upstream dataset.
- For a fixed node and time window, the settings preview fetches the available field set once and remaps chart axes, series normalization, and series colors locally so those changes do not trigger a new remote data request.
- Each widget instance can either follow the current dashboard date or persist its own fixed `start/end` date.
- The chart path is tolerant of Python-style datetime strings and can recover a usable X/Y pair from returned rows when metadata is incomplete.
- When a grouped line or area chart resolves to one point per series, the TradingView renderer enables point markers so sparse daily snapshots stay visible.
- If the incoming dataset still triggers a chart-library failure, the widget shows a local recovery
  message instead of surfacing a route-level application error.

## Settings preview

- Core configuration now comes from the shared source/date-range schema renderer plus the
  visualizer-specific schema sections, while preview and per-series color tuning stay in the
  widget-specific advanced settings panel.
- The settings modal fetches the selected node's latest observation and uses its time index as the default fixed-date end when needed.
- The preview anchors its request on the latest available row for the node and keeps the current range span, so stale datasets still render in settings.
- When the graph is bound to another `Data Node`, the preview header now prefers the linked
  dataset's published range over the dashboard/query range so the settings panel reflects the
  actual upstream rows being graphed.
- That depends on the upstream `Data Node` publishing its range through the shared headless dataset
  contract, which the Data Node widget now does for both runtime and published-output resolution
  paths.
- Visualization settings focus on the mounted chart renderer and provider-specific controls.
- The preview can switch locally between chart and table without changing the live widget surface.
- Table preview requests all available fields so the preview grid shows the full row shape, not only the mapped chart columns.
- Axis pickers and preview now prefer runtime field inference from the resolved bound dataset, so
  an `AppComponent -> Data Node -> Graph` chain can populate X/Y/group mappings from the actual
  published frame even when there is no direct `dataNodeId` metadata at the graph layer.
- The graph settings now expose the resolved source schema in a modal so users can inspect the
  field provenance, declared/native types, warnings, and sample values that drive axis and group
  selection.
- When the linked `Data Node` is still waiting on an executable upstream source, both the mounted
  widget and the settings preview now surface that as an explicit "resolving upstream source"
  state instead of falling through to stale axis/preview messaging.
- Fixed-date presets and inputs update the widget instance configuration directly.
- The previewed series list also drives the per-series color editors, so overrides stay aligned with the current grouping output.
- The preview summary also reports when chart-local group filters remove series before rendering.
- In the mounted widget, the visualizer always stays on the chart so the table remains a settings-only inspection tool.
- The mounted chart now sizes directly to the available widget body, so dashboard resizing should shrink the visualizer instead of cropping it behind hardcoded chart minimums.
- Very long daily histories may require a lower `Min point spacing` value so TradingView can fit
  the whole series on first render; the library default `0.5px` spacing is too high for large
  datasets in narrow widgets.

## Defaults

- X axis defaults to `time_index_name` when available, otherwise the first time-like field or first indexed field.
- Time axis mode defaults to `Auto`.
- Grouping defaults to the second index field when present.
- Y axis defaults to the first non-index numeric field.
- Date range defaults to the dashboard date until the widget is switched to a fixed range.
- When normalization is enabled without an explicit anchor date, the chart rebases each series to the first visible date in the active range.
- Supported providers are currently `TradingView` (Lightweight Charts) and `ECharts`.
