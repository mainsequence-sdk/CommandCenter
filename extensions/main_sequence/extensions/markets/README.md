# Main Sequence Markets

This nested extension is the separate application shell for market-facing Main Sequence workflows.

## Entry Points

- `index.ts`: registers the Markets extension.
- `app.ts`: declares the `AppDefinition` for `main_sequence_markets`.
- `features/`: Markets surfaces and feature-owned workflows.

## Current Surfaces

- `asset-categories/`: category registry with create/edit/delete flows, a dedicated detail page, and nested asset loading.
- `asset-translation-tables/`: translation table registry with a dedicated detail page and embedded rules manager.
- `assets/`: read-only asset registry list with dedicated detail loading.
- `execution-venues/`: execution venue registry with create flow and a dedicated detail page for edit/delete.

## Dependencies

- Shared Main Sequence UI, hooks, and API helpers come from `../../common/`.

## Rules

- Keep this extension independent from Workbench. Shared code must move into `../../common/`.
- Add a local `README.md` whenever you introduce a new feature folder here.
