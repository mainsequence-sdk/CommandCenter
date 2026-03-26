# Demo Data

This folder owns the mock data providers used by the external Demo extension.

## Entry Points

- `mock-api.ts`: deterministic market, activity, and order-book payloads used whenever the shell
  switches into mock mode or widget preview mode.

## Maintenance Notes

- Keep demo-only data sources here instead of under `src/data/`.
- Shared live data contracts should stay under `src/data/` so non-demo features do not depend on
  extension-local type ownership.
