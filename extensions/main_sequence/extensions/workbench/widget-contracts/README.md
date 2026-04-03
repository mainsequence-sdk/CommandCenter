# Widget Contracts

This directory owns shared, versioned data contracts used for widget-to-widget composition in the
Main Sequence Workbench extension.

## Entry Points

- `mainSequenceDataSourceBundle.ts`: Main Sequence adapter around the shared tabular-frame contract.
  It keeps the Data Node family on one normalized `columns + rows + fields + source` shape while
  preserving Main Sequence-specific source context under `source.kind = "main-sequence-data-node"`.
  The shared `fields[]` schema is intentionally generic:
  `key`, `label?`, `type`, `description?`, `nullable?`, `nativeType?`.

## Notes

- Contracts in this directory are extension-level integration boundaries, not widget-local runtime
  helpers.
- Keep contract ids versioned with the `@vN` suffix so dashboards can validate bindings and evolve
  safely over time.
- Shared contract payloads should be producer-owned normalized shapes. Consumers should depend on
  these contracts instead of importing producer-family runtime internals directly.
- Main Sequence source-specific metadata such as data-node identity, fixed range, and identifier
  filters should stay nested under the shared `source` descriptor rather than leaking into the root
  tabular frame contract.
