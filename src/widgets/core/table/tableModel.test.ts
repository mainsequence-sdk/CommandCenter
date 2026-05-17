import { describe, expect, it } from "vitest";

import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import { CORE_VALUE_JSON_CONTRACT } from "@/widgets/shared/value-contracts";

import { tableWidget } from "./definition";
import {
  buildTableWidgetRowKey,
  formatTableWidgetValue,
  TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
  TABLE_WIDGET_DATASET_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
  resolveTableWidgetActiveCellOutput,
  resolveTableWidgetActiveCellValueOutput,
  resolveTableWidgetActiveRowOutput,
  resolveTableWidgetOutput,
  resolveTableWidgetProps,
  resolveTableWidgetSelectedRowsOutput,
  parseTableWidgetDateTimeValue,
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
  });
});
