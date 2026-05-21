import { describe, expect, it } from "vitest";

import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import {
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  resolveIncrementalTabularOutputFrame,
} from "@/widgets/shared/incremental-tabular-consumer";
import { TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";
import type { ResolvedWidgetInputs } from "@/widgets/types";

import { tableWidget } from "./definition";
import { proTableWidget } from "./proDefinition";
import { compileTableFormulaExpression } from "./tableFormulaCompiler";
import {
  buildTableWidgetFrameFromRemoteData,
  buildTableWidgetRowObjects,
  buildTableWidgetRowKey,
  formatTableWidgetValue,
  moveTableWidgetSchemaColumn,
  TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
  TABLE_WIDGET_DATASET_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
  resolveTableWidgetActiveCellOutput,
  resolveTableWidgetActiveCellValueOutput,
  resolveTableWidgetActiveRowOutput,
  resolveTableWidgetOutput,
  resolveTableWidgetSelectedCellValuesOutput,
  resolveTableWidgetProps,
  resolveTableWidgetSelectedRowsOutput,
  parseTableWidgetDateTimeValue,
  resolveTableWidgetPropsWithFrame,
  validateTableWidgetSchema,
  type TableWidgetProps,
} from "./tableModel";

describe("table widget datetime formatting", () => {
  it("parses epoch timestamps across second and millisecond units", () => {
    expect(parseTableWidgetDateTimeValue(1777112662203)).toBe(1777112662203);
    expect(parseTableWidgetDateTimeValue("1777112662")).toBe(1777112662000);
  });

  it("uses an explicit input pattern before rendering an output pattern", () => {
    expect(
      formatTableWidgetValue("26/04/2026 10:21:02.203", {
        compact: false,
        dateTimeInputFormat: "dd/MM/yyyy HH:mm:ss.SSS",
        dateTimeOutputFormat: "yyyy-MM-dd HH:mm:ss.SSS",
        format: "datetime",
      }),
    ).toBe("2026-04-26 10:21:02.203");
  });

  it("does not treat datetime columns as numeric validation failures", () => {
    const validation = validateTableWidgetSchema(
      [{ openTime: "2026-04-26T10:21:02.203Z" }],
      [{ key: "openTime", format: "datetime" }],
    );

    expect(validation.issues).toEqual([]);
  });
});

describe("table widget formula compiler", () => {
  it("requires bracketed field references and explains invalid bare identifiers", () => {
    expect(compileTableFormulaExpression("last_price*10")).toEqual({
      expression: null,
      error:
        "Formula syntax is invalid. Wrap field names in brackets, for example [last_price] * 10. Functions must also use bracketed fields, for example PERCENT_CHANGE([last_price], [yearStart]).",
    });
  });
});

describe("table widget selection outputs", () => {
  const manualTableProps: TableWidgetProps = {
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
    selectionMode: "multi-row",
    selectionKeyFields: ["id"],
  };

  it("publishes selected rows as a canonical tabular frame", () => {
    const selectedKey = buildTableWidgetRowKey({ id: "b" }, ["id"]);
    const selectedRows = resolveTableWidgetSelectedRowsOutput(
      manualTableProps,
      undefined,
      {
        interaction: {
          selection: {
            mode: "multi-row",
            selectedRowKeys: selectedKey ? [selectedKey] : [],
            selectedRowIndices: [],
            updatedAtMs: 1,
          },
        },
      },
    );

    expect(selectedRows.columns).toEqual(["id", "name", "score"]);
    expect(selectedRows.rows).toEqual([{ id: "b", name: "Beta", score: 20 }]);
    expect(selectedRows.source?.kind).toBe("table-widget-selection");
  });

  it("publishes active row and active cell JSON values", () => {
    const selectedKey = buildTableWidgetRowKey({ id: "c" }, ["id"]);
    const runtimeState = {
      interaction: {
        selection: {
          mode: "cell",
          selectedRowKeys: selectedKey ? [selectedKey] : [],
          selectedRowIndices: [2],
          activeRowKey: selectedKey,
          activeRowIndex: 2,
          activeCell: {
            rowKey: selectedKey,
            rowIndex: 2,
            columnKey: "score",
            value: 30,
          },
          selectedCells: [
            {
              rowKey: selectedKey,
              rowIndex: 2,
              columnKey: "score",
              value: 30,
            },
          ],
          updatedAtMs: 1,
        },
      },
    };
    const props: TableWidgetProps = {
      ...manualTableProps,
      selectionMode: "cell",
    };

    expect(resolveTableWidgetActiveRowOutput(props, undefined, runtimeState)).toEqual({
      id: "c",
      name: "Gamma",
      score: 30,
    });
    expect(resolveTableWidgetActiveCellOutput(props, undefined, runtimeState)).toEqual({
      rowKey: selectedKey,
      rowIndex: 2,
      columnKey: "score",
      value: 30,
      row: {
        id: "c",
        name: "Gamma",
        score: 30,
      },
    });
    expect(resolveTableWidgetActiveCellValueOutput(props, undefined, runtimeState)).toBe(30);
  });

  it("publishes the active cell value from row-selection clicks", () => {
    const selectedKey = buildTableWidgetRowKey({ id: "b" }, ["id"]);
    const runtimeState = {
      interaction: {
        selection: {
          mode: "single-row",
          selectedRowKeys: selectedKey ? [selectedKey] : [],
          selectedRowIndices: [1],
          activeRowKey: selectedKey,
          activeRowIndex: 1,
          activeCell: {
            rowKey: selectedKey,
            rowIndex: 1,
            columnKey: "name",
            value: "Beta",
          },
          selectedCells: [
            {
              rowKey: selectedKey,
              rowIndex: 1,
              columnKey: "name",
              value: "Beta",
            },
          ],
          updatedAtMs: 1,
        },
      },
    };
    const props: TableWidgetProps = {
      ...manualTableProps,
      selectionMode: "single-row",
    };

    expect(resolveTableWidgetPropsWithFrame(props).selectionMode).toBe("single-row");
    expect(resolveTableWidgetPropsWithFrame(props).publishSelectionOutputs).toBe(true);
    expect(resolveTableWidgetActiveCellOutput(props, undefined, runtimeState)).toEqual({
      rowKey: selectedKey,
      rowIndex: 1,
      columnKey: "name",
      value: "Beta",
      row: {
        id: "b",
        name: "Beta",
        score: 20,
      },
    });
    expect(resolveTableWidgetActiveCellValueOutput(props, undefined, runtimeState)).toBe("Beta");
    expect(resolveTableWidgetSelectedCellValuesOutput(props, undefined, runtimeState)).toEqual([
      "Beta",
    ]);
  });

  it("normalizes shared table grouping from widget props", () => {
    const props: TableWidgetProps = {
      ...manualTableProps,
      groupBy: "name",
    };

    expect(resolveTableWidgetPropsWithFrame(props).groupBy).toBe("name");
  });

  it("does not publish selections when selection mode is off", () => {
    const selectedRows = resolveTableWidgetSelectedRowsOutput(
      {
        ...manualTableProps,
        selectionMode: "none",
      },
      undefined,
      {
        interaction: {
          selection: {
            mode: "multi-row",
            selectedRowIndices: [0, 1],
            selectedRowKeys: [],
            updatedAtMs: 1,
          },
        },
      },
    );

    expect(selectedRows.rows).toEqual([]);
  });

  it("publishes interaction outputs when selection mode is implicit from a downstream consumer", () => {
    const selectedKey = buildTableWidgetRowKey({ id: "b" }, ["id"]);
    const runtimeState = {
      interaction: {
        selection: {
          mode: "cell",
          implicitMode: true,
          selectedRowKeys: selectedKey ? [selectedKey] : [],
          selectedRowIndices: [1],
          activeRowKey: selectedKey,
          activeRowIndex: 1,
          activeCell: {
            rowKey: selectedKey,
            rowIndex: 1,
            columnKey: "name",
            value: "Beta",
          },
          selectedCells: [
            {
              rowKey: selectedKey,
              rowIndex: 1,
              columnKey: "name",
              value: "Beta",
            },
          ],
          updatedAtMs: 1,
        },
      },
    };
    const props: TableWidgetProps = {
      ...manualTableProps,
      selectionMode: "none",
    };

    expect(resolveTableWidgetActiveRowOutput(props, undefined, runtimeState)).toEqual({
      id: "b",
      name: "Beta",
      score: 20,
    });
    expect(resolveTableWidgetActiveCellOutput(props, undefined, runtimeState)).toEqual({
      rowKey: selectedKey,
      rowIndex: 1,
      columnKey: "name",
      value: "Beta",
      row: {
        id: "b",
        name: "Beta",
        score: 20,
      },
    });
    expect(resolveTableWidgetActiveCellValueOutput(props, undefined, runtimeState)).toBe("Beta");
  });

  it("publishes selected cell values as an ordered JSON list", () => {
    const alphaKey = buildTableWidgetRowKey({ id: "a" }, ["id"]);
    const betaKey = buildTableWidgetRowKey({ id: "b" }, ["id"]);
    const props: TableWidgetProps = {
      ...manualTableProps,
      selectionMode: "cell",
    };
    const runtimeState = {
      interaction: {
        selection: {
          mode: "cell",
          selectedRowKeys: [alphaKey, betaKey].filter((value): value is string => Boolean(value)),
          selectedRowIndices: [0, 1],
          activeRowKey: betaKey,
          activeRowIndex: 1,
          activeCell: {
            rowKey: betaKey,
            rowIndex: 1,
            columnKey: "name",
            value: "Beta",
          },
          selectedCells: [
            {
              rowKey: alphaKey,
              rowIndex: 0,
              columnKey: "name",
              value: "Alpha",
            },
            {
              rowKey: betaKey,
              rowIndex: 1,
              columnKey: "name",
              value: "Beta",
            },
          ],
          updatedAtMs: 1,
        },
      },
    };

    expect(resolveTableWidgetSelectedCellValuesOutput(props, undefined, runtimeState)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("keeps the full dataset output unchanged by selection state", () => {
    const dataset = resolveTableWidgetOutput(
      manualTableProps,
      undefined,
      {
        interaction: {
          selection: {
            mode: "multi-row",
            selectedRowIndices: [1],
            selectedRowKeys: [],
            updatedAtMs: 1,
          },
        },
      },
    );

    expect(dataset.rows).toEqual([
      { id: "a", name: "Alpha", score: 10 },
      { id: "b", name: "Beta", score: 20 },
      { id: "c", name: "Gamma", score: 30 },
    ]);
  });

  it("does not publish stale active cells outside cell mode", () => {
    const runtimeState = {
      interaction: {
        selection: {
          mode: "cell",
          selectedRowIndices: [1],
          selectedRowKeys: [],
          activeCell: {
            rowIndex: 1,
            columnKey: "score",
            value: 20,
          },
          updatedAtMs: 1,
        },
      },
    };

    expect(
      resolveTableWidgetActiveCellOutput(
        {
          ...manualTableProps,
          selectionMode: "single-row",
        },
        undefined,
        runtimeState,
      ),
    ).toBeNull();
  });
});

describe("table widget table controls", () => {
  it("normalizes quick filter and column filter visibility", () => {
    expect(resolveTableWidgetProps({}).showSearch).toBe(true);
    expect(resolveTableWidgetProps({}).showColumnFilters).toBe(true);
    expect(
      resolveTableWidgetProps({
        showSearch: false,
        showColumnFilters: false,
      }),
    ).toMatchObject({
      showSearch: false,
      showColumnFilters: false,
    });
  });

  it("reorders schema columns without mutating the original array", () => {
    const original = [
      { key: "symbol", label: "Symbol", format: "text" as const },
      { key: "last_price", label: "Last", format: "currency" as const },
      { key: "volume", label: "Volume", format: "number" as const },
    ];

    const reordered = moveTableWidgetSchemaColumn(original, 2, 0);

    expect(reordered.map((column) => column.key)).toEqual([
      "volume",
      "symbol",
      "last_price",
    ]);
    expect(original.map((column) => column.key)).toEqual([
      "symbol",
      "last_price",
      "volume",
    ]);
    expect(reordered[1]).not.toBe(original[0]);
  });

  it("applies shared source metadata for computed columns and visuals", () => {
    const frameInput = buildTableWidgetFrameFromRemoteData(
      null,
      [
        {
          unique_identifier: "uid:AAPL",
          last_price: 110,
          previous_close: 100,
          sparkline_prices: "98,101,104,110",
        },
      ],
      ["unique_identifier", "last_price", "previous_close", "sparkline_prices"],
      [],
      {
        tableTransforms: {
          computedColumns: [
            {
              id: "one_day_return",
              label: "1D",
              type: "number",
              expression: {
                op: "percentChange",
                current: { field: "last_price" },
                reference: { field: "previous_close" },
              },
            },
          ],
        },
        tableVisuals: {
          columns: {
            unique_identifier: {
              label: "Identifier",
              width: 180,
            },
            last_price: {
              label: "Last",
              format: "price",
              decimals: 2,
              width: 120,
            },
            one_day_return: {
              label: "1D",
              format: "percent",
              thresholds: [
                { operator: "lt", value: 0, tone: "warning" },
                { operator: "gt", value: 0, tone: "success" },
              ],
            },
            sparkline_prices: {
              label: "Trend",
              kind: "sparkline",
              width: 128,
            },
          },
        },
      },
    );

    expect(frameInput.columns).toEqual([
      "unique_identifier",
      "last_price",
      "previous_close",
      "sparkline_prices",
      "one_day_return",
    ]);

    const resolved = resolveTableWidgetPropsWithFrame({}, frameInput);
    const identifierColumn = resolved.schema.find((column) => column.key === "unique_identifier");
    const lastColumn = resolved.schema.find((column) => column.key === "last_price");
    const returnColumn = resolved.schema.find((column) => column.key === "one_day_return");

    expect(identifierColumn).toMatchObject({
      label: "Identifier",
      minWidth: 180,
    });
    expect(lastColumn).toMatchObject({
      label: "Last",
      decimals: 2,
      format: "number",
      minWidth: 120,
    });
    expect(returnColumn).toMatchObject({
      label: "1D",
      format: "percent",
    });
    expect(resolved.columnOverrides.one_day_return).toMatchObject({
      compact: false,
    });
    expect(resolved.conditionalRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columnKey: "one_day_return", operator: "lt", tone: "warning" }),
        expect.objectContaining({ columnKey: "one_day_return", operator: "gt", tone: "success" }),
      ]),
    );
    expect(resolved.rows[0]?.[resolved.columns.indexOf("one_day_return")]).toBe(10);
  });

  it("accepts source-declared formula columns from table visual metadata", () => {
    const frameInput = buildTableWidgetFrameFromRemoteData(
      null,
      [
        {
          unique_identifier: "uid:BTCUSDT",
          last_price: 109420,
          previous_close: 107980,
        },
      ],
      ["unique_identifier", "last_price", "previous_close"],
      [],
      {
        tableVisuals: {
          columns: {
            unique_identifier: {
              label: "Identifier",
            },
            last_price: {
              label: "Last",
              format: "price",
            },
            previous_close: {
              label: "Previous close",
              format: "price",
              visible: false,
            },
            one_day_return: {
              label: "1D",
              format: "formula",
              formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
              formulaResultFormat: "percent",
              gaugeMode: "ring",
            },
          },
        },
      },
    );
    const resolved = resolveTableWidgetPropsWithFrame({
      formulasEnabled: true,
    }, frameInput);
    const rows = buildTableWidgetRowObjects(resolved.columns, resolved.rows);

    expect(frameInput.columns).toEqual([
      "unique_identifier",
      "last_price",
      "previous_close",
      "one_day_return",
    ]);
    expect(frameInput.schemaFallback.find((column) => column.key === "one_day_return")).toMatchObject({
      label: "1D",
      format: "formula",
      formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
      formulaResultFormat: "percent",
    });
    expect(resolved.columnOverrides.previous_close).toMatchObject({
      visible: false,
    });
    expect(resolved.columnOverrides.one_day_return).toMatchObject({
      gaugeMode: "ring",
    });
    expect(rows[0]?.one_day_return).toBeCloseTo(1.3335802926467864);
  });

  it("computes local formula columns through the shared table frame path", () => {
    const props: TableWidgetProps = {
      tableSourceMode: "manual",
      formulasEnabled: true,
      manualColumns: [
        { key: "symbol", type: "string" },
        { key: "last_price", type: "number" },
        { key: "yearStart", type: "number" },
      ],
      manualRows: [
        { symbol: "AAPL", last_price: 118, yearStart: 100 },
      ],
      schema: [
        { key: "symbol", label: "Symbol", format: "text" },
        { key: "last_price", label: "Last", format: "number" },
        { key: "yearStart", label: "Year Start", format: "number" },
        {
          key: "ytd",
          label: "YTD",
          format: "formula",
          formulaExpression: "PERCENT_CHANGE([last_price], [yearStart])",
          formulaResultFormat: "percent",
        },
      ],
    };

    const output = resolveTableWidgetOutput(props, undefined);
    expect(output.columns).toEqual(["symbol", "last_price", "yearStart", "ytd"]);
    expect(output.rows[0]).toMatchObject({
      symbol: "AAPL",
      last_price: 118,
      yearStart: 100,
      ytd: 18,
    });

    const resolved = resolveTableWidgetPropsWithFrame(props);
    const rows = buildTableWidgetRowObjects(resolved.columns, resolved.rows);

    expect(resolved.formulasEnabled).toBe(true);
    expect(rows[0]?.ytd).toBe(18);
  });

  it("recomputes formula columns after partial live row patches", () => {
    const seedFrame = {
      status: "ready",
      columns: ["symbol", "last_price", "previous_close", "one_day_return"],
      rows: [
        {
          symbol: "BTCUSDT",
          last_price: 100,
          previous_close: 100,
        },
      ],
      meta: {
        tableVisuals: {
          columns: {
            one_day_return: {
              label: "1D",
              format: "formula",
              formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
              formulaResultFormat: "percent",
            },
          },
        },
      },
      source: { kind: "seed" },
    };
    const liveFrame = {
      status: "ready",
      columns: ["symbol", "last_price"],
      rows: [
        {
          symbol: "BTCUSDT",
          last_price: 110,
        },
      ],
      source: { kind: "live" },
    };
    const patchedFrame = resolveIncrementalTabularOutputFrame({
      resolvedInputs: {
        [TABULAR_SEED_INPUT_ID]: {
          inputId: TABULAR_SEED_INPUT_ID,
          label: "Seed",
          status: "valid",
          sourceWidgetId: "seed",
          sourceOutputId: "dataset",
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          value: seedFrame,
          upstreamBase: seedFrame,
        },
        [TABULAR_LIVE_UPDATES_INPUT_ID]: {
          inputId: TABULAR_LIVE_UPDATES_INPUT_ID,
          label: "Live",
          status: "valid",
          sourceWidgetId: "live",
          sourceOutputId: "updates",
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          value: liveFrame,
          upstreamBase: liveFrame,
        },
      } satisfies ResolvedWidgetInputs,
      liveMergeKeyFields: ["symbol"],
    });
    const frameInput = buildTableWidgetFrameFromRemoteData(
      null,
      patchedFrame?.rows ?? [],
      patchedFrame?.columns ?? [],
      patchedFrame?.fields ?? [],
      patchedFrame?.meta,
    );
    const resolved = resolveTableWidgetPropsWithFrame(
      { formulasEnabled: true },
      frameInput,
    );
    const rows = buildTableWidgetRowObjects(resolved.columns, resolved.rows);

    expect(rows[0]?.previous_close).toBe(100);
    expect(rows[0]?.last_price).toBe(110);
    expect(rows[0]?.one_day_return).toBe(10);
  });

  it("collapses repeated live rows using table-level merge mappings before rendering", () => {
    const frameInput = buildTableWidgetFrameFromRemoteData(
      null,
      [
        { symbol: "ETHUSDT", last: 2143 },
        { symbol: "ETHUSDT", last: 2144 },
        { symbol: "ETHUSDT", last: 2145 },
      ],
      ["symbol", "last"],
    );
    const resolved = resolveTableWidgetPropsWithFrame(
      {
        liveMergeKeyMappings: [{ seedField: "symbol", liveField: "symbol" }],
      },
      frameInput,
    );
    const rows = buildTableWidgetRowObjects(resolved.columns, resolved.rows);

    expect(rows).toEqual([
      {
        symbol: "ETHUSDT",
        last: 2145,
      },
    ]);
  });

  it("applies table-level merge mappings to published bound output", () => {
    const sourceFrame = {
      status: "ready",
      columns: ["ticker", "last"],
      rows: [
        { ticker: "BTCUSDT", last: 77650 },
        { ticker: "BTCUSDT", last: 77655 },
      ],
      fields: [
        { key: "ticker", label: "Ticker", type: "string" },
        { key: "last", label: "Last", type: "number" },
      ],
    } as const;
    const output = resolveTableWidgetOutput(
      {
        liveMergeKeyMappings: [{ seedField: "symbol", liveField: "ticker" }],
      },
      {
        [TABULAR_SOURCE_INPUT_ID]: {
          inputId: TABULAR_SOURCE_INPUT_ID,
          label: "Source",
          status: "valid",
          sourceWidgetId: "source-table",
          sourceOutputId: "dataset",
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          value: sourceFrame,
          upstreamBase: sourceFrame,
        },
      } satisfies ResolvedWidgetInputs,
    );

    expect(output.columns).toEqual(["symbol", "last"]);
    expect(output.rows).toEqual([
      {
        symbol: "BTCUSDT",
        last: 77655,
      },
    ]);
    expect(output.fields?.map((field) => field.key)).toEqual(["symbol", "last"]);
  });
});

describe("table widget definition selection outputs", () => {
  it("advertises dataset and selection output contracts", () => {
    expect(tableWidget.io).toBeDefined();
    const outputContracts = new Map(
      (tableWidget.io?.outputs ?? []).map((output) => [output.id, output.contract]),
    );

    expect(outputContracts.get(TABLE_WIDGET_DATASET_OUTPUT_ID)).toBe(CORE_TABULAR_FRAME_SOURCE_CONTRACT);
    expect(outputContracts.get(TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID)).toBe(CORE_TABULAR_FRAME_SOURCE_CONTRACT);
    expect(outputContracts.get(TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID)).toBe(CORE_VALUE_JSON_CONTRACT);
    expect(outputContracts.get(TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID)).toBe(CORE_VALUE_JSON_CONTRACT);
    expect(outputContracts.get(TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID)).toBe(CORE_VALUE_JSON_CONTRACT);
    expect(outputContracts.get(TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID)).toBe(CORE_VALUE_JSON_CONTRACT);
  });

  it("adds a Pro variant without changing the Community table contract", () => {
    expect(tableWidget.id).toBe("table");
    expect(proTableWidget.id).toBe("pro-table");
    expect((tableWidget.exampleProps as TableWidgetProps).formulasEnabled).toBe(false);
    expect((proTableWidget.exampleProps as TableWidgetProps).formulasEnabled).toBe(true);
    expect(tableWidget.registryContract?.capabilities).toMatchObject({
      gridEdition: "community",
      supportedSourceModes: ["bound", "connection", "connection-stream", "manual"],
    });
    expect(proTableWidget.registryContract?.capabilities).toMatchObject({
      gridEdition: "enterprise",
      formulas: ["columnLevelFormulas", "settingsOnlyAuthoring"],
      supportedSourceModes: ["bound", "connection", "connection-stream", "manual"],
    });

    expect(
      (proTableWidget.io?.outputs ?? []).map((output) => [output.id, output.contract]),
    ).toEqual(
      (tableWidget.io?.outputs ?? []).map((output) => [output.id, output.contract]),
    );
  });
});
