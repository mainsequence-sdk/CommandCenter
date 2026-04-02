# Widget Contracts

This directory owns shared, versioned data contracts used for widget-to-widget composition in the
Main Sequence Workbench extension.

## Entry Points

- `mainSequenceDataSourceBundle.ts`: canonical Data Node source bundle contract published by Data
  Node producers and consumed by downstream widgets such as the Data Node visualizer.

## Notes

- Contracts in this directory are extension-level integration boundaries, not widget-local runtime
  helpers.
- Keep contract ids versioned with the `@vN` suffix so dashboards can validate bindings and evolve
  safely over time.
- Shared contract payloads should be producer-owned normalized shapes. Consumers should depend on
  these contracts instead of importing producer-family runtime internals directly.
