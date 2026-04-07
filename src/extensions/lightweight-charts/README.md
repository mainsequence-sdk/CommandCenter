# Lightweight Charts Extension

This extension owns the Lightweight Charts integration layer used by live widget registrations.

## Entry Points

- `index.ts`: registers the integration-backed widget catalog entries.

## Current Responsibilities

- The `price-chart` widget implementation from `src/widgets/extensions/lightweight-charts/`
- Lightweight Charts dependency isolation so vendor chart code stays out of core widget folders

## Maintenance Notes

- The stable `price-chart` widget id is currently classified as `main_sequence_markets` in its
  widget definition. Keep business ownership metadata there, while continuing to isolate
  Lightweight Charts implementation details under this extension/module boundary.
- If additional Lightweight Charts widgets are added later, document them here and keep their
  implementation details in the widget module folder.
