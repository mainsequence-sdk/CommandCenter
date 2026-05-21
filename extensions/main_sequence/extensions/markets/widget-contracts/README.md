# Markets Widget Contracts

This directory owns shared, Markets-scoped data models and adapters used by Main Sequence Markets
widgets. These models are intentionally local to the Markets extension so core widgets and
connections do not depend on market-specific asset, price, and reference-point semantics.

## Entry Points

- `marketAssetFrames.ts`: shared Asset Screener data structures, internal lane-role metadata,
  adapters from `core.tabular_frame@v1`, and derived row helpers.

## Notes

- Market visualization widgets should import shared asset models from this directory instead of
  defining their own asset identity, reference-point, history-series, or live-update shapes.
- Asset Screener semantics are internal widget lane roles over generic `core.tabular_frame@v1`
  inputs. Connections should not publish or advertise Asset Screener-specific market contracts.
- The public Asset Screener widget bindings are `seedData` and optional `liveUpdates`; historical
  baselines and compact trends are seeded through inline metadata on the seed frame.
- Dynamic metric columns are represented as semantic `valueKey`s such as `price`, `volume`,
  `marketCap`, or `peRatio`; widget column config chooses which value keys to render.
- Shared row-local computed metrics must be materialized before the Markets semantic adapter sees
  the frame. Use an upstream `tabular-transform` when a reusable dataset needs derived fields such
  as `oneDayReturn`.
- Compact terminal visuals can be described in `meta.tableVisuals.columns` and inline
  `sparklineSeries` field roles. This is widget-side interpretation metadata over a generic table,
  not a connection-specific output contract.
- `meta.tableVisuals.columns` can also propose the default widget column configuration. Widget
  settings should show that derived configuration even when market field-role metadata is absent;
  `meta.marketAsset.fieldRoles` refine the mapping when present. Instance-level column overrides
  remain local widget props and take precedence. Derived columns should carry the source visual
  metadata on a `visual` property so theme-tone color scales and compact visual hints are not
  hidden outside settings.
- Metadata precedence is explicit widget field mappings first, Markets metadata second, and
  field-name heuristics last.
- `meta.tableVisuals` is deliberately descriptive. The shared runtime model preserves all supported
  visual metadata, but individual widgets decide which hints they render immediately.
- Runtime ownership stays with Connection Query, Connection Stream Query, and Tabular Transform.
  Consumers such as Asset Screener should adapt bound frames and live updates, not fetch backend
  data or open WebSockets directly.
- Large source frames should continue to live in the workspace runtime data store when available;
  screener runtime state should carry refs and summary metadata once the widget is implemented.
