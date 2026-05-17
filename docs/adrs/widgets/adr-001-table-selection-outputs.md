# ADR 001: Table Selection Outputs for Widget Composition

- Status: Accepted
- Date: 2026-05-17

## Context

The core Table widget is already a useful composition primitive: it can consume a bound tabular
frame, consume a hidden managed connection source, render a formatted AG Grid table, and republish
one canonical `core.tabular_frame@v1` dataset for downstream widgets.

The missing composition surface is user interaction. A workspace author cannot currently bind a
detail panel, chart, AppComponent, prompt, or another table to the row or cell that a user selected
inside a Table widget. The selected row, selected rows, active cell, and active cell value are
runtime facts that downstream widgets should be able to consume like any other widget output.

Current constraints:

- `src/widgets/core/table/definition.ts` publishes only the full `dataset` output.
- `src/widgets/core/table/TableWidget.tsx` receives `runtimeState` and `onRuntimeStateChange`, so
  it can persist local interaction state without becoming an execution-owner widget.
- `src/widgets/core/table/TableFrameView.tsx` renders the interactive table surface but does not
  currently configure row selection, cell-click handling, or selection publication.
- Selection must not mutate the source dataset or table formatting props.
- Selection state is user interaction state, not backend data and not durable table authoring state.

## Decision

Extend the core Table widget with first-class interaction outputs backed by per-user runtime state.

The Table widget will continue to publish its existing full `dataset` output unchanged. In addition,
it will optionally publish derived interaction outputs for selected rows and the active cell.

Selection configuration belongs in table props because it is authoring behavior. The selected rows
and selected cell belong in widget runtime state because they are user interaction state.

## Runtime State Contract

Store compact interaction state under a table-owned runtime namespace:

```ts
interface TableWidgetInteractionRuntimeState {
  interaction?: {
    selection?: {
      mode: "none" | "single-row" | "multi-row" | "cell";
      selectedRowKeys: string[];
      selectedRowIndices: number[];
      activeRowKey?: string;
      activeRowIndex?: number;
      activeCell?: {
        rowKey?: string;
        rowIndex: number;
        columnKey: string;
        value: unknown;
      };
      updatedAtMs: number;
    };
  };
}
```

Do not store full selected row payloads in runtime state. Output resolvers should derive row payloads
from the current resolved table dataset plus the compact selection keys or indices. This keeps the
runtime state small and avoids stale row snapshots after upstream refresh.

## Selection Identity

Row identity should be stable when possible:

- Prefer explicit `selectionKeyFields` configured on the Table widget.
- If no explicit key fields are configured, use upstream unique identifier metadata when available.
- If neither exists, fall back to row index.

Row-index fallback is allowed, but it must be documented as unstable when filtering, sorting,
pagination, or upstream refresh changes row order.

## Output Ports

Add Table output ports without changing the existing `dataset` output:

- `selectedRows`
  - Contract: `core.tabular_frame@v1`
  - Value: the current table frame filtered to selected rows.
  - Empty value: ready tabular frame with the same columns and zero rows.

- `activeRow`
  - Contract: `core.value.json@v1`
  - Value: the active row object, or `null` when there is no active row.

- `activeCell`
  - Contract: `core.value.json@v1`
  - Value: `{ rowKey?, rowIndex, columnKey, value, row }`, or `null`.

- `activeCellValue`
  - Contract: `core.value.json@v1`
  - Value: the selected cell value, or `null`.
  - Use JSON first. Do not add dynamic scalar output contracts in this implementation slice.

These outputs are passive. They are resolved from `props`, `resolvedInputs`, `runtimeState`, and the
runtime data store like the existing `dataset` output.

## Table Props

Add durable authoring props for selection behavior:

```ts
interface TableWidgetSelectionProps {
  selectionMode?: "none" | "single-row" | "multi-row" | "cell";
  selectionKeyFields?: string[];
  publishSelectionOutputs?: boolean;
}
```

Default behavior should preserve today:

- `selectionMode`: `"none"`
- `selectionKeyFields`: `[]`
- `publishSelectionOutputs`: `true` once selection mode is not `"none"`

## Implementation Tasks

- [x] Add table selection model helpers.
  - [x] Define normalized selection props in `src/widgets/core/table/tableModel.ts`.
  - [x] Define runtime-state normalization helpers for `interaction.selection`.
  - [x] Add helpers that resolve the current canonical table frame once and derive selected rows,
    active row, active cell, and active cell value from it.

- [x] Extend Table widget IO.
  - [x] Keep the existing `dataset` output unchanged.
  - [x] Add `selectedRows`, `activeRow`, `activeCell`, and `activeCellValue` outputs in
    `src/widgets/core/table/definition.ts`.
  - [x] Use `core.tabular_frame@v1` for selected rows and `core.value.json@v1` for object/scalar
    interaction outputs.
  - [x] Update `registryContract.io.outputContracts`, `ioNotes`, and capabilities so backend-synced
    widget metadata advertises these outputs.

- [x] Wire table-renderer interaction capture.
  - [x] Extend `TableFrameView` props with selection configuration and an interaction callback.
  - [x] Configure the current table renderer for single-row and multi-row selection modes.
  - [x] Configure cell click/focus handling for cell mode.
  - [x] Add a stable `getRowId` when selection keys are available.
  - [x] Publish compact selection updates through `onRuntimeStateChange`.

- [x] Preserve source and formatting semantics.
  - [x] Ensure selection does not change `manualRows`, upstream rows, table columns, filters,
    formatting, or conditional styles.
  - [x] Ensure quick filter, column filters, sorting, and pagination affect what the user can
    select, while output resolution still derives against the canonical current table frame.

- [x] Add settings controls.
  - [x] Add a Selection section in `TableWidgetSettings`.
  - [x] Include controls for selection mode and row key fields.
  - [x] Source row key field options from the resolved table schema.
  - [x] Add concise `(i)` help text for unstable row-index fallback.

- [x] Add tests.
  - [x] Add model tests for selection normalization and output derivation.
  - [x] Add definition tests for new output ids and contracts.
  - [x] Add component tests for single row, multi row, and active cell runtime-state publication.
  - [x] Add a regression test that the existing `dataset` output remains unchanged.

- [x] Update documentation.
  - [x] Update `src/widgets/core/table/README.md`.
  - [x] Update `src/widgets/core/table/USAGE_GUIDANCE.md`.
  - [x] Mention that selection outputs are per-user runtime interaction outputs and not
    backend-owned data.

- [x] Verify.
  - [x] Run `npm run check`.
  - [x] Run the focused table tests.
  - [x] Confirm no registry contract snapshot files exist to update.

## Backend Contract Impact

This changes the frontend widget registry contract because the Table widget will advertise new IO
outputs and updated usage guidance.

It does not require a backend execution endpoint. Selection is derived locally from already
materialized table data and per-user widget runtime state.

Backend-facing follow-up may be needed only if the backend validates or stores synced widget
registry contracts with fixed output metadata.

## Consequences

Positive:

- Enables detail views, charts, AppComponents, and prompts that react to table selection.
- Keeps the existing full dataset output stable.
- Uses existing runtime-state and widget-output resolution infrastructure.
- Avoids treating UI selection as persisted authoring data.

Tradeoffs:

- Row-index fallback can become unstable after refresh, sort, or filter changes.
- Multi-row selected output can be large if users select many rows.
- Passive downstream widgets can consume the selection immediately, but executable downstream
  widgets will not automatically re-run unless a separate graph-execution trigger is added later.

## Deferred Work

- Dynamic scalar output contracts for `activeCellValue`.
- A generic interaction-output contract shared by other widgets.
- Cross-widget execution triggers caused by interaction-state changes.
- Keyboard range selection and pinned selection summaries.
