import { describe, expect, it } from "vitest";

import { buildWidgetReferencePropInputId } from "@/dashboards/widget-instance-references";
import type { WidgetExecutionContext } from "@/widgets/types";

import type { ConnectionQueryWidgetProps } from "./connectionQueryModel";
import { connectionQueryWidget } from "./definition";

function buildExecutionContext(
  overrides: Partial<WidgetExecutionContext<ConnectionQueryWidgetProps>> = {},
): WidgetExecutionContext<ConnectionQueryWidgetProps> {
  return {
    executionSurface: "private-dashboard",
    widgetId: "connection-query",
    instanceId: "connection-query-1",
    reason: "dashboard-refresh",
    props: {
      connectionRef: {
        id: 5,
        typeId: "finance.binance-market-data",
      },
      queryModelId: "binance-usdm-futures-ohlc",
      query: {
        kind: "binance-usdm-futures-ohlc",
        symbols: [null],
      },
      timeRangeMode: "none",
    },
    runtimeState: undefined,
    resolvedInputs: {
      [buildWidgetReferencePropInputId(["query", "symbols"])]: {
        inputId: buildWidgetReferencePropInputId(["query", "symbols"]),
        status: "valid",
        sourceWidgetId: "asset-screener-1",
        sourceOutputId: "activeCellValue",
        value: null,
      },
    },
    ...overrides,
  } as WidgetExecutionContext<ConnectionQueryWidgetProps>;
}

describe("connectionQueryWidget automatic execution readiness", () => {
  it("allows automatic execution when a reference-backed query input resolved to null", () => {
    const context = buildExecutionContext();

    expect(connectionQueryWidget.execution?.canExecute?.(context)).toBe(true);
    expect(connectionQueryWidget.execution?.getRefreshPolicy?.(context)).toBe("allow-refresh");
  });

  it("blocks automatic execution when a reference-backed query input is not resolved", () => {
    const inputId = buildWidgetReferencePropInputId(["query", "symbols"]);
    const context = buildExecutionContext({
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-ohlc",
        query: {
          kind: "binance-usdm-futures-ohlc",
          symbols: ["$(asset-screener-1).activeCellValue"],
        },
        timeRangeMode: "none",
      },
      resolvedInputs: {
        [inputId]: {
          inputId,
          label: "Setting: query.symbols",
          status: "missing-output",
          sourceWidgetId: "asset-screener-1",
          sourceOutputId: "activeCellValue",
        },
      },
    });

    expect(connectionQueryWidget.execution?.canExecute?.(context)).toBe(false);
    expect(connectionQueryWidget.execution?.getRefreshPolicy?.(context)).toBe("manual-only");
  });

  it("allows automatic execution when target overrides provide a concrete query value", () => {
    const context = buildExecutionContext({
      targetOverrides: {
        props: {
          connectionRef: {
            id: 5,
            typeId: "finance.binance-market-data",
          },
          queryModelId: "binance-usdm-futures-ohlc",
          query: {
            kind: "binance-usdm-futures-ohlc",
            symbols: ["ETHUSDT"],
          },
          timeRangeMode: "none",
        },
      },
    });

    expect(connectionQueryWidget.execution?.canExecute?.(context)).toBe(true);
    expect(connectionQueryWidget.execution?.getRefreshPolicy?.(context)).toBe("allow-refresh");
  });

  it("blocks manual test execution for unresolved reference-backed query inputs", () => {
    const inputId = buildWidgetReferencePropInputId(["query", "symbols"]);
    const context = buildExecutionContext({
      reason: "settings-test",
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-ohlc",
        query: {
          kind: "binance-usdm-futures-ohlc",
          symbols: ["$(asset-screener-1).activeCellValue"],
        },
        timeRangeMode: "none",
      },
      resolvedInputs: {
        [inputId]: {
          inputId,
          label: "Setting: query.symbols",
          status: "missing-output",
          sourceWidgetId: "asset-screener-1",
          sourceOutputId: "activeCellValue",
        },
      },
    });

    expect(connectionQueryWidget.execution?.canExecute?.(context)).toBe(false);
  });
});
