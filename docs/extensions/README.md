---
id: extensions-index
title: Extensions
slug: /extensions
---

This section covers the extension model for adding apps, widgets, themes, and product-specific
workflows without turning the shell into a junk drawer.

## Read This Section First

1. [Extensions Overview](./overview.md)
2. Platform extension index: `src/extensions/core/README.md`
3. Flow Lab extension: `src/extensions/flow-lab/README.md`
4. Main Sequence extension root: `extensions/main_sequence/README.md`
5. Main Sequence Workbench extension: `extensions/main_sequence/extensions/workbench/README.md`
6. Main Sequence Markets extension: `extensions/main_sequence/extensions/markets/README.md`

## How To Extend Through Extensions

- Add product-specific widgets, apps, themes, and workflows through an extension before touching
  platform core.
- Keep shared extension behavior documented here, but keep implementation ownership in the
  extension-local `README.md`.
- If an extension owns widgets, also update the relevant widget-family index in
  [`../widgets/README.md`](../widgets/README.md).

## Guidelines

- Repo-level docs about extension architecture belong in `docs/extensions/`.
- Implementation docs for a specific extension belong in that extension's directory `README.md`.
- When one extension introduces a new top-level feature area, add both the local `README.md` and
  the repo-level docs link in this section.
