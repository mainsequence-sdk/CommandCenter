/** @vitest-environment jsdom */

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

type MockGridRow = Record<string, unknown>;
type MockGridColumn = {
  cellRenderer?: unknown;
  cellRendererParams?: unknown;
  colId?: string;
  field?: string;
  filter?: unknown;
  valueGetter?: unknown;
};
type MockGridFocusedCell = {
  rowIndex: number;
  column: { getColId: () => string };
};
type MockGridCellRange = {
  startRow?: { rowIndex: number };
  endRow?: { rowIndex: number };
  columns: Array<{ getColId: () => string }>;
  startColumn: { getColId: () => string };
};
type MockGridApi = {
  getCellRanges: () => MockGridCellRange[] | null;
  getDisplayedRowAtIndex: (index: number) => { data?: MockGridRow } | null;
  getFocusedCell: () => MockGridFocusedCell | null;
  getSelectedRows: () => MockGridRow[];
};
type MockAgGridReactProps = {
  columnDefs?: MockGridColumn[];
  onCellClicked?: (event: {
    api?: MockGridApi;
    colDef: MockGridColumn;
    column: { getColId: () => string };
    data: MockGridRow;
  }) => void;
  onSelectionChanged?: (event: {
    api: MockGridApi;
  }) => void;
  rowData?: MockGridRow[];
};

const agGridReactMockState = vi.hoisted(() => ({
  lastProps: null as MockAgGridReactProps | null,
}));

vi.mock("ag-grid-react", async () => {
  const React = await import("react");

  return {
    AgGridProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    AgGridReact: (props: MockAgGridReactProps) => {
      agGridReactMockState.lastProps = props;
      const rows = props.rowData ?? [];
      const columns = props.columnDefs ?? [];
      const buildApi = (
        selectedRows: MockGridRow[],
        focusedCell: MockGridFocusedCell | null,
        cellRanges: MockGridCellRange[],
      ): MockGridApi => ({
        getCellRanges: () => cellRanges,
        getDisplayedRowAtIndex: (index: number) => {
          const row = rows[index];
          return row ? { data: row } : null;
        },
        getFocusedCell: () => focusedCell,
        getSelectedRows: () => selectedRows,
      });

      return React.createElement(
        "div",
        { "data-testid": "ag-grid-mock" },
        ...rows.map((row, rowIndex) =>
          React.createElement(
            "button",
            {
              key: `select-row-${rowIndex}`,
              "data-testid": `select-row-${rowIndex}`,
              type: "button",
              onClick: () => {
                props.onSelectionChanged?.({
                  api: buildApi([row], null, []),
                });
              },
            },
            `Select row ${rowIndex}`,
          ),
        ),
        React.createElement(
          "button",
          {
            key: "select-multi",
            "data-testid": "select-multi",
            type: "button",
            onClick: () => {
              props.onSelectionChanged?.({
                api: buildApi(rows.slice(0, 2), null, []),
              });
            },
          },
          "Select multiple rows",
        ),
        ...rows.flatMap((row, rowIndex) =>
          columns.map((column) => {
            const columnKey = column.field ?? column.colId ?? "";

            return React.createElement(
              "button",
              {
                key: `cell-${rowIndex}-${columnKey}`,
                "data-testid": `cell-${rowIndex}-${columnKey}`,
                type: "button",
                onClick: () => {
                  const api = buildApi(
                    [row],
                    {
                      rowIndex,
                      column: {
                        getColId: () => column.colId ?? column.field ?? "",
                      },
                    },
                    [
                      {
                        startRow: { rowIndex },
                        endRow: { rowIndex },
                        columns: [
                          {
                            getColId: () => column.colId ?? column.field ?? "",
                          },
                        ],
                        startColumn: {
                          getColId: () => column.colId ?? column.field ?? "",
                        },
                      },
                    ],
                  );

                  props.onCellClicked?.({
                    api,
                    colDef: column,
                    column: {
                      getColId: () => column.colId ?? column.field ?? "",
                    },
                    data: row,
                  });
                },
              },
              `Cell ${rowIndex} ${columnKey}`,
            );
          }),
        ),
      );
    },
  };
});

const [
  { TableFrameView, resolveTableGaugeVisual },
  {
    buildTableWidgetFrameFromManualData,
    resolveTableWidgetPropsWithFrame,
    tableWidgetDefaultProps,
  },
] = await Promise.all([
  import("./TableFrameView"),
  import("./tableModel"),
]);

type TableWidgetProps = import("./tableModel").TableWidgetProps;
type TableWidgetSelectionMode = import("./tableModel").TableWidgetSelectionMode;
type TableWidgetSelectionState = import("./tableModel").TableWidgetSelectionState;
type ThemeTokens = import("@mainsequence/command-center-themes").ThemeTokens;

const testTokens = {
  primary: "#ffffff",
  success: "#61C8FF",
  warning: "#E8A23C",
  danger: "#FF67B3",
  border: "#101723",
  foreground: "#F8FBFF",
  "muted-foreground": "#93A3BC",
} satisfies Pick<
  ThemeTokens,
  "primary" | "success" | "warning" | "danger" | "border" | "foreground" | "muted-foreground"
>;

function buildResolvedTableProps(
  selectionMode: TableWidgetSelectionMode,
  groupBy?: string,
) {
  const props: TableWidgetProps = {
    ...tableWidgetDefaultProps,
    tableSourceMode: "manual",
    manualColumns: [
      { key: "desk", type: "string" },
      { key: "id", type: "string" },
      { key: "name", type: "string" },
      { key: "score", type: "number" },
    ],
    manualRows: [
      { desk: "Blue", id: "a", name: "Alpha", score: 10 },
      { desk: "Blue", id: "b", name: "Beta", score: 20 },
      { desk: "Red", id: "c", name: "Gamma", score: 30 },
    ],
    groupBy,
    pagination: false,
    selectionKeyFields: ["id"],
    selectionMode,
    showSearch: false,
    showToolbar: false,
  };

  return resolveTableWidgetPropsWithFrame(
    props,
    buildTableWidgetFrameFromManualData(props),
  );
}

function createHarness(
  selectionMode: TableWidgetSelectionMode,
  groupBy?: string,
  options: {
    columnDefOverrides?: ComponentProps<typeof TableFrameView>["columnDefOverrides"];
  } = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const selectionEvents: TableWidgetSelectionState[] = [];

  return {
    container,
    selectionEvents,
    async render() {
      await act(async () => {
        root.render(
          <TableFrameView
            columnDefOverrides={options.columnDefOverrides}
            resolvedProps={buildResolvedTableProps(selectionMode, groupBy)}
            selectionKeyFields={["id"]}
            selectionMode={selectionMode}
            onSelectionChange={(selection) => {
              selectionEvents.push(selection);
            }}
          />,
        );
      });
    },
    async click(testId: string) {
      const element = container.querySelector(`[data-testid="${testId}"]`);
      expect(element).toBeInstanceOf(HTMLElement);

      await act(async () => {
        (element as HTMLElement).click();
      });
    },
    cleanup() {
      void act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const harnesses: Array<ReturnType<typeof createHarness>> = [];

afterEach(() => {
  while (harnesses.length > 0) {
    harnesses.pop()?.cleanup();
  }

  agGridReactMockState.lastProps = null;
});

describe("TableFrameView selection publishing", () => {
  it("publishes single-row selection runtime state", async () => {
    const harness = createHarness("single-row");
    harnesses.push(harness);

    await harness.render();
    await harness.click("select-row-1");

    expect(harness.selectionEvents).toHaveLength(1);
    expect(harness.selectionEvents[0]).toMatchObject({
      mode: "single-row",
      selectedRowKeys: ['["b"]'],
      selectedRowIndices: [1],
      activeRowKey: '["b"]',
      activeRowIndex: 1,
    });
  });

  it("publishes multi-row selection runtime state", async () => {
    const harness = createHarness("multi-row");
    harnesses.push(harness);

    await harness.render();
    await harness.click("select-multi");

    expect(harness.selectionEvents).toHaveLength(1);
    expect(harness.selectionEvents[0]).toMatchObject({
      mode: "multi-row",
      selectedRowKeys: ['["a"]', '["b"]'],
      selectedRowIndices: [0, 1],
      activeRowKey: '["b"]',
      activeRowIndex: 1,
    });
  });

  it("publishes active-cell state from row-selection clicks", async () => {
    const harness = createHarness("single-row");
    harnesses.push(harness);

    await harness.render();
    await harness.click("cell-1-score");

    expect(harness.selectionEvents).toHaveLength(1);
    expect(harness.selectionEvents[0]).toMatchObject({
      mode: "single-row",
      selectedRowKeys: ['["b"]'],
      selectedRowIndices: [1],
      activeRowKey: '["b"]',
      activeRowIndex: 1,
      activeCell: {
        rowKey: '["b"]',
        rowIndex: 1,
        columnKey: "score",
        value: 20,
      },
    });
  });

  it("applies per-column AG Grid overrides without forking the shared table view", async () => {
    const harness = createHarness("none", undefined, {
      columnDefOverrides: {
        score: {
          cellRenderer: "agSparklineCellRenderer",
          filter: false,
        },
      },
    });
    harnesses.push(harness);

    await harness.render();

    const scoreColumn = agGridReactMockState.lastProps?.columnDefs?.find(
      (column) => column.field === "score",
    );

    expect(scoreColumn?.cellRenderer).toBe("agSparklineCellRenderer");
    expect(scoreColumn?.filter).toBe(false);
  });

  it("preserves active-cell state when row selection fires after a cell click", async () => {
    const harness = createHarness("single-row");
    harnesses.push(harness);

    await harness.render();
    await harness.click("cell-1-score");
    await harness.click("select-row-1");

    expect(harness.selectionEvents[harness.selectionEvents.length - 1]).toMatchObject({
      mode: "single-row",
      selectedRowKeys: ['["b"]'],
      selectedRowIndices: [1],
      activeRowKey: '["b"]',
      activeRowIndex: 1,
      activeCell: {
        rowKey: '["b"]',
        rowIndex: 1,
        columnKey: "score",
        value: 20,
      },
    });
  });

  it("publishes active-cell runtime state", async () => {
    const harness = createHarness("cell");
    harnesses.push(harness);

    await harness.render();
    await harness.click("cell-1-score");

    expect(harness.selectionEvents).toHaveLength(1);
    expect(harness.selectionEvents[0]).toMatchObject({
      mode: "cell",
      selectedRowKeys: ['["b"]'],
      selectedRowIndices: [1],
      activeRowKey: '["b"]',
      activeRowIndex: 1,
      activeCell: {
        rowKey: '["b"]',
        rowIndex: 1,
        columnKey: "score",
        value: 20,
      },
      selectedCells: [
        {
          rowKey: '["b"]',
          rowIndex: 1,
          columnKey: "score",
          value: 20,
        },
      ],
    });
  });

  it("ignores grouped header rows and preserves canonical row indexes", async () => {
    const harness = createHarness("single-row", "desk");
    harnesses.push(harness);

    await harness.render();
    await harness.click("cell-0-desk");
    expect(harness.selectionEvents).toHaveLength(0);

    await harness.click("cell-1-name");
    expect(harness.selectionEvents).toHaveLength(1);
    expect(harness.selectionEvents[0]).toMatchObject({
      mode: "single-row",
      selectedRowKeys: ['["a"]'],
      selectedRowIndices: [0],
      activeRowKey: '["a"]',
      activeRowIndex: 0,
      activeCell: {
        rowKey: '["a"]',
        rowIndex: 0,
        columnKey: "name",
        value: "Alpha",
      },
    });
  });
});

describe("TableFrameView gauge geometry", () => {
  it("fills to the right from the cell center for positive values", () => {
    expect(
      resolveTableGaugeVisual(
        1.5,
        { min: -3, max: 3 },
        { tone: "success" },
        testTokens as ThemeTokens,
      ),
    ).toEqual({
      color: "#61C8FF",
      direction: "right",
      ratio: 0.5,
    });
  });

  it("fills to the left from the cell center for negative values", () => {
    expect(
      resolveTableGaugeVisual(
        -1.5,
        { min: -3, max: 3 },
        { tone: "warning" },
        testTokens as ThemeTokens,
      ),
    ).toEqual({
      color: "#E8A23C",
      direction: "left",
      ratio: 0.5,
    });
  });

  it("uses the largest absolute bound instead of forcing a 1.0 denominator", () => {
    expect(
      resolveTableGaugeVisual(
        0.4,
        { min: 0.4, max: 1.6 },
        null,
        testTokens as ThemeTokens,
      ),
    ).toEqual({
      color: "#ffffff",
      direction: "right",
      ratio: 0.25,
    });
  });

  it("shows no fill for zero values", () => {
    expect(
      resolveTableGaugeVisual(
        0,
        { min: -3, max: 3 },
        { tone: "neutral" },
        testTokens as ThemeTokens,
      ),
    ).toEqual({
      color: "#93A3BC",
      direction: null,
      ratio: 0,
    });
  });
});
