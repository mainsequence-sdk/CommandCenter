---
id: widgets-index
title: Widgets
slug: /widgets
---

This section explains how widgets fit into the product, when to reuse an existing widget, and
where to go when you need the contract for a specific widget family.

## Read This Section First

1. [Core Widgets](./core-widgets.md)
2. Platform widget index in code: `src/widgets/README.md`

## How To Extend Widgets

- Add new widget concepts to this docs section only when they affect the shared widget contract.
- Keep implementation details in the nearest widget folder `README.md`.
- When a widget is introduced, update the relevant widget-family index so it links to that local
  `README.md`.
- Document inputs, outputs, settings, persistence, runtime ownership, and important constraints.

## Widget Readmes

### Platform Core Widgets

- `src/widgets/core/app-component/README.md`
- `src/widgets/core/graph/README.md`
- `src/widgets/core/markdown-note/README.md`
- `src/widgets/core/rich-text-note/README.md`
- `src/widgets/core/statistic/README.md`
- `src/widgets/core/table/README.md`
- `src/widgets/core/workspace-row/README.md`

### Platform Extension Widget Families

- `src/widgets/extensions/ag-grid/README.md`
- `src/widgets/extensions/echarts/README.md`
- `src/widgets/extensions/lightweight-charts/README.md`

### Main Sequence Widget Families

- `extensions/main_sequence/extensions/workbench/widgets/README.md`
- `extensions/main_sequence/extensions/workbench/widgets/dependency-graph/README.md`
- `extensions/main_sequence/extensions/workbench/widgets/project-infra-graph/README.md`
- `extensions/main_sequence/extensions/markets/widgets/README.md`
- `extensions/main_sequence/extensions/markets/widgets/curve-plot/README.md`
- `extensions/main_sequence/extensions/markets/widgets/zero-curve/README.md`
- `extensions/main_sequence/extensions/markets/widgets/portfolio-weights-table/README.md`

## Guidelines

- Do not make widget docs purely descriptive. State how to author, configure, and extend them.
- If a widget belongs to one extension, its implementation docs should live with that extension.
- If a widget exposes custom settings, bindings, or runtime-state behavior, document that in the
  widget folder `README.md` rather than hiding it only in code.
