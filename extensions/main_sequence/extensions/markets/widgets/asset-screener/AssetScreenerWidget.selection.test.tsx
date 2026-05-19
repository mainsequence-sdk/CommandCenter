/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mainSequenceAssetScreenerWidget } from "./definition";
import { AssetScreenerWidget } from "./AssetScreenerWidget";
import {
  assetScreenerDefaultProps,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";
import {
  buildMarketAssetFrameSemanticMeta,
  MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
} from "../../widget-contracts/marketAssetFrames";
import { TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID } from "@/widgets/core/table/tableModel";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

type MockGridRow = Record<string, unknown>;
type MockGridColumn = {
  colId?: string;
  field?: string;
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

vi.mock("ag-grid-react", async () => {
  const React = await import("react");

  return {
    AgGridProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    AgGridReact: (props: MockAgGridReactProps) => {
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

const dashboardExecutionMocks = vi.hoisted(() => ({
  useResolveWidgetUpstream: vi.fn(),
}));

const runtimeDataStoreMocks = vi.hoisted(() => ({
  useRuntimeDataStore: vi.fn(() => null),
}));
const dependencyMocks = vi.hoisted(() => ({
  useWorkspaceVariableReferenceRegistry: vi.fn(() => ({
    bySourceWidgetId: new Map(),
  })),
}));

vi.mock("@/dashboards/DashboardWidgetExecution", () => dashboardExecutionMocks);
vi.mock("@/dashboards/DashboardWidgetDependencies", () => dependencyMocks);
vi.mock("@/widgets/shared/runtime-data-store", async () => {
  const actual = await vi.importActual<typeof import("@/widgets/shared/runtime-data-store")>(
    "@/widgets/shared/runtime-data-store",
  );

  return {
    ...actual,
    useRuntimeDataStore: runtimeDataStoreMocks.useRuntimeDataStore,
  };
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  host?.remove();
  root = null;
  host = null;
  dashboardExecutionMocks.useResolveWidgetUpstream.mockClear();
  runtimeDataStoreMocks.useRuntimeDataStore.mockReset();
  runtimeDataStoreMocks.useRuntimeDataStore.mockReturnValue(null);
  dependencyMocks.useWorkspaceVariableReferenceRegistry.mockReset();
  dependencyMocks.useWorkspaceVariableReferenceRegistry.mockReturnValue({
    bySourceWidgetId: new Map(),
  });
});

function marketSeedFrame(rows: Array<Record<string, unknown>>) {
  return {
    status: "ready" as const,
    columns: Object.keys(rows[0] ?? {}),
    rows,
    meta: buildMarketAssetFrameSemanticMeta({
      role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
      fieldRoles: [
        { field: "unique_identifier", role: "assetKey" },
        { field: "Symbol", role: "symbol" },
        { field: "sector", role: "sector" },
        { field: "last_price", role: "value", valueKey: "price" },
      ],
    }),
  };
}

function renderWidget({
  onRuntimeStateChange,
  props,
}: {
  onRuntimeStateChange: (nextRuntimeState: unknown) => void;
  props: MainSequenceAssetScreenerWidgetProps;
}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root?.render(
      <AssetScreenerWidget
        instanceId="asset-screener-selection-test"
        instanceTitle="Asset Screener"
        onRuntimeStateChange={onRuntimeStateChange}
        props={props}
        runtimeState={{
          marketAssetScreenerDemoFrames: {
            seedData: marketSeedFrame([
              {
                unique_identifier: "uid:AAPL",
                Symbol: "AAPL",
                sector: "Technology",
                last_price: 112.25,
              },
              {
                unique_identifier: "uid:JPM",
                Symbol: "JPM",
                sector: "Financials",
                last_price: 198.42,
              },
            ]),
          },
        }}
        widget={mainSequenceAssetScreenerWidget}
      />,
    );
  });

  return host;
}

function queryFirstMatchingElement(
  container: ParentNode,
  selectors: string[],
) {
  for (const selector of selectors) {
    const match = container.querySelector(selector);

    if (match) {
      return match;
    }
  }

  return null;
}

describe("AssetScreenerWidget selection publishing", () => {
  it("publishes sanitized runtime selection for asset rows and ignores group headers", async () => {
    dependencyMocks.useWorkspaceVariableReferenceRegistry.mockReturnValue({
      bySourceWidgetId: new Map([
        [
          "asset-screener-selection-test",
          [
            {
              key: {
                sourceOutputId: TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
              },
            },
          ],
        ],
      ]),
    });
    const runtimeEvents: unknown[] = [];

    const container = renderWidget({
      onRuntimeStateChange: (nextRuntimeState) => {
        runtimeEvents.push(nextRuntimeState);
      },
      props: {
        ...assetScreenerDefaultProps,
        columnConfigMode: "custom",
        columns: [
          {
            id: "symbol",
            kind: "asset-field",
            label: "Symbol",
            field: "symbol",
          },
          {
            id: "last",
            kind: "latest-value",
            label: "Last",
            valueField: "price",
            format: "price",
          },
        ],
        sort: undefined,
        table: {
          groupBy: "sector",
        },
      },
    });

    const groupHeaderCell = container.querySelector('[data-testid="cell-0-symbol"]');
    expect(groupHeaderCell).toBeInstanceOf(HTMLElement);
    const beforeGroupHeaderClick = runtimeEvents.length;
    await act(async () => {
      (groupHeaderCell as HTMLElement).click();
    });

    expect(runtimeEvents).toHaveLength(beforeGroupHeaderClick);

    const assetCell = queryFirstMatchingElement(container, [
      '[data-testid="cell-1-symbol"]',
      '[data-testid="cell-0-symbol"]',
      '[data-testid="cell-2-symbol"]',
    ]);
    expect(assetCell).toBeInstanceOf(HTMLElement);
    await act(async () => {
      (assetCell as HTMLElement).click();
    });

    expect(runtimeEvents.at(-1)).toMatchObject({
      interaction: {
        selection: {
          mode: "cell",
          selectedRowKeys: ['["uid:AAPL"]'],
          selectedRowIndices: [0],
          activeRowKey: '["uid:AAPL"]',
          activeRowIndex: 0,
          activeCell: {
            rowKey: '["uid:AAPL"]',
            rowIndex: 0,
            columnKey: "symbol",
            value: "AAPL",
          },
        },
      },
    });
  });

});
