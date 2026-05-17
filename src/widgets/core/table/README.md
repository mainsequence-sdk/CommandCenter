# Table Widget

This folder owns the core `table` widget. It is a generic consumer for `core.tabular_frame@v1`
datasets, plus a manual table editor that also republishes one canonical tabular frame.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, agent snapshot, and settings/component wiring.
- `TableWidget.tsx`: source/binding owner for the generic table widget. It resolves bound,
  manual, connection, and incremental table sources, then delegates rendering to `TableFrameView`.
- `TableFrameView.tsx`: reusable AG Grid-backed table frame renderer for table-backed widgets.
  It owns table-native formatting, threshold rules, heatmaps, data bars, gauges, quick filtering,
  schema validation display, and optional per-column custom cell renderers.
- `TableWidgetSettings.tsx`: settings editor for source binding status, manual rows, compact per-column schema controls, selection outputs, collapsible advanced formatting, datetime display patterns, value labels, and numeric rules.
- `managedConnectionConsumer.ts`: shared managed-connection adapter that lets the generic widget-settings route create one hidden `connection-query` or `connection-stream-query` source for this table.
- `ManualTableEditor.tsx`: spreadsheet-style editor for manual display rows.
- `tableModel.ts`: table configuration normalization, frame adaptation, schema resolution, selection output resolution, formatting helpers, datetime parsing/rendering, and validation.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- Bound and live-capable modes now expose explicit roles:
  - `seedData` for retained dataset baselines
  - `liveUpdates` for explicit incremental `updates` publications
- Managed connection modes bind those roles automatically:
  - managed HTTP source -> `dataset` to `seedData`
  - managed WS source -> `updates` to `liveUpdates`
- When the table owns a hidden managed connection source, settings show that source's
  current runtime status and error message even though the source widget stays out of the normal
  rail.
- Bound mode reads the resolved input's generic `upstreamBase` frame when an incremental upstream
  source publishes retained base plus delta metadata. The table currently renders the retained
  snapshot; it does not apply row deltas imperatively.
- The widget always publishes one `core.tabular_frame@v1` output on `dataset`.
- Optional interaction outputs publish the current user selection: `selectedRows` as a filtered
  `core.tabular_frame@v1`, plus `activeRow`, `activeCell`, and `activeCellValue` as JSON values.
  Selection state is stored in widget runtime state so downstream consumers can resolve outputs
  without mutating the underlying dataset.
- Both canvas rendering and downstream output publication now normalize bound-source state through
  the shared upstream consumer contract before applying table-specific schema or formatting logic.
  That keeps invalid bindings, awaiting upstream publication, loading, empty success, and errors
  separate instead of inferring readiness from `null` frames or `0 rows`.
- The runtime renderer resolves either the dual-role local incremental state or the legacy bound
  dataset path. It does not read dashboard refresh controls directly.
- Legacy backend time-series frames are coerced into canonical tabular rows before table
  formatting is applied.
- If a bound source incorrectly hands the table a connection response envelope, the table unwraps
  the first compatible `frames[]` entry before rendering.
- Manual mode stores `manualColumns` and `manualRows` locally on this widget and publishes them as
  a canonical tabular frame.
- `Bindings -> Add connection` and the dedicated `Connection` tab are owned by the shared managed
  connection consumer adapter layer, not by table-specific settings code.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection
  Query and Tabular Transform.
- Incoming `fields[]` metadata is preserved where possible. When missing, the table infers display
  schema from columns and sampled rows.
- The column editor keeps `key`, `label`, `format`, and visibility inline for every row. Less-used
  per-column settings stay under an explicit Advanced toggle to reduce settings noise.
- `Date/time` columns parse common ISO strings plus epoch seconds, milliseconds, microseconds, and
  nanoseconds automatically. Advanced column settings may provide a local-time input pattern when
  auto parsing is ambiguous, and an output pattern for display. Supported pattern tokens are
  `yyyy`, `yy`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `hh`, `h`, `mm`, `m`, `ss`, `s`, `SSS`, and `a`.
- Formatting and selection are presentation/runtime concerns and never mutate the published
  `dataset` tabular frame.
- `TableFrameView` is the reusable table presentation layer. Domain-specific widgets should adapt
  their domain model into a resolved table frame and table-native display config, then use this
  view instead of implementing another grid.
- The global quick filter and AG Grid floating column filters are separately configurable. Quick
  filter searches across the rendered row values from the toolbar; column filters expose the
  per-column searchable/filterable header controls.
- `TableFrameView` supports domain-specific presentation flags. The generic Table widget keeps
  the card surface and floating column filters; specialized consumers such as Asset Screener can
  opt into a transparent surface and disable per-column filters while still reusing table
  formatting, conditional rules, and custom cell rendering.

## Maintenance Constraints

- Keep the registered id as `table`.
- Keep accepted input aligned with `core.tabular_frame@v1`.
- Keep the primary published output aligned with `core.tabular_frame@v1`; selection-specific JSON
  outputs must remain derived from runtime interaction state.
- Selection state is local workspace runtime state. Backend registry sync needs the extra output
  metadata, but the canonical tabular dataset contract is unchanged.
- Do not reintroduce table-owned date-range or source-resolution runtime behavior; execution and
  refresh belong upstream to Connection Query and Tabular Transform.
- Keep AG Grid usage inside the community feature set unless a future change explicitly documents
  an enterprise dependency.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing
  authoring semantics change.
