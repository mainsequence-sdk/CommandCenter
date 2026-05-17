/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

type MockGridRow = Record<string, unknown>;
type MockGridColumn = {
  colId?: string;
  field?: string;
};
type MockAgGridReactProps = {
  columnDefs?: MockGridColumn[];
  onCellClicked?: (event: {
    colDef: MockGridColumn;
    column: { getColId: () => string };
    data: MockGridRow;
  }) => void;
  onSelectionChanged?: (event: {
    api: {
      getSelectedRows: () => MockGridRow[];
    };
  }) => void;
  rowData?: MockGridRow[];
};

vi.mock("ag-grid-react", async () => {
  const React = await import("react");

  return {
    AgGridProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    AgGridReact: (props: MockAgGridReactProps) => {
      const rows = props.rowData ?? [];
      const columns = props.columnDefs ?? [];

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
                  api: {
                    getSelectedRows: () => [row],
                  },
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
                api: {
                  getSelectedRows: () => rows.slice(0, 2),
                },
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
                  props.onCellClicked?.({
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
  { TableFrameView },
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

function buildResolvedTableProps(selectionMode: TableWidgetSelectionMode) {
  const props: TableWidgetProps = {
    ...tableWidgetDefaultProps,
    tableSourceMode: "manual",
    manualColumns: [
      { key: "id", type: "string" },
      { key: "name", type: "string" },
      { key: "score", type: "number" },
    ],
    manualRows: [
      { id: "a", name: "Alpha", score: 10 },
      { id: "b", name: "Beta", score: 20 },
      { id: "c", name: "Gamma", score: 30 },
    ],
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

function createHarness(selectionMode: TableWidgetSelectionMode) {
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
            resolvedProps={buildResolvedTableProps(selectionMode)}
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
    });
  });
});
