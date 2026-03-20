# Main Sequence Nested Extensions

This directory contains independently registered Main Sequence extensions.

## Current Extensions

- `workbench/`: operational and CRUD-heavy Main Sequence administration surfaces.
- `markets/`: market-facing Main Sequence app surfaces.

## Rules

- Each nested extension must expose its own `index.ts` entrypoint.
- Shared code belongs in `../common/`, not in another nested extension.
- Keep ids, routes, and widget `source` values aligned with the owning nested extension.
