# Main Sequence Common Assets

Shared static assets for Main Sequence domain UI live here.

## Contents

- `physical-data-sources/`: feature-scoped physical-data-source icons that are not shared through the
  generic connection asset catalog. Shared database/provider logos such as DuckDB and Timescale now
  live in `src/connections/assets/`.

## Rules

- Keep assets here only when they are intended to be reused across more than one Main Sequence extension.
- Feature-specific media should stay with the owning feature when reuse is unlikely.
