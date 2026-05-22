/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ConnectionInstance,
  ConnectionTypeDefinition,
} from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import type { WidgetExecutionDashboardState } from "@/widgets/types";

import { ConnectionQueryWorkbench } from "./ConnectionQueryWorkbench";

vi.mock("@/connections/hooks", () => ({
  useConnectionInstances: () => ({
    data: [],
  }),
}));

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function flushEffects() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

const connectionInstance: ConnectionInstance = {
  id: 5,
  typeId: "binance-usdm",
  typeVersion: 1,
  name: "Binance USDM",
  publicConfig: {},
  secureFields: {},
  status: "ok",
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:00:00.000Z",
};

const connectionType: ConnectionTypeDefinition = {
  id: "binance-usdm",
  version: 1,
  title: "Binance USDM",
  description: "Test connection type",
  source: "core",
  category: "Markets",
  capabilities: ["query"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    fields: [],
  },
  queryModels: [
    {
      id: "binance-usdm-futures-ohlc",
      label: "Futures OHLC",
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      defaultQuery: {
        kind: "binance-usdm-futures-ohlc",
        interval: "1m",
      },
      supportsMaxRows: true,
    },
  ],
};

const dashboardState: WidgetExecutionDashboardState = {
  timeRangeKey: "15m",
  rangeStartMs: Date.parse("2026-05-17T18:54:03.064Z"),
  rangeEndMs: Date.parse("2026-05-17T19:09:03.064Z"),
  refreshIntervalMs: null,
};

describe("ConnectionQueryWorkbench", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("builds the request preview from resolved reference-backed props", async () => {
    await act(async () => {
      root.render(
        <ConnectionQueryWorkbench
          value={{
            connectionRef: {
              id: 5,
              typeId: "binance-usdm",
            },
            queryModelId: "binance-usdm-futures-ohlc",
            query: {
              kind: "binance-usdm-futures-ohlc",
              symbols: [
                "$(TABLE-D8BA1F58-C442-4C7F-9B28-1D905E23A380).ACTIVECELLVALUE",
              ],
              interval: "1m",
            },
            timeRangeMode: "dashboard",
            maxRows: 1000,
          }}
          resolvedValue={{
            connectionRef: {
              id: 5,
              typeId: "binance-usdm",
            },
            queryModelId: "binance-usdm-futures-ohlc",
            query: {
              kind: "binance-usdm-futures-ohlc",
              symbols: ["BTCUSDT"],
              interval: "1m",
            },
            timeRangeMode: "dashboard",
            maxRows: 1000,
          }}
          onChange={() => {}}
          connectionInstance={connectionInstance}
          connectionType={connectionType}
          dashboardState={dashboardState}
          showConnectionPicker={false}
          showQueryEditor={false}
          connectionPathSettings={null}
        />,
      );
      await flushEffects();
    });

    const requestPreview = Array.from(container.querySelectorAll("pre")).find((entry) =>
      entry.textContent?.includes('"connectionId": 5'),
    );

    expect(requestPreview?.textContent).toContain("BTCUSDT");
    expect(requestPreview?.textContent).not.toContain("ACTIVECELLVALUE");
    expect(requestPreview?.textContent).not.toContain("TABLE-D8BA1F58");
  });

  it("keeps resolved query fields when auto-selecting the query model", async () => {
    await act(async () => {
      root.render(
        <ConnectionQueryWorkbench
          value={{
            connectionRef: {
              id: 5,
              typeId: "binance-usdm",
            },
            query: {
              symbols: [
                "$(TABLE-D8BA1F58-C442-4C7F-9B28-1D905E23A380).ACTIVECELLVALUE",
              ],
            },
            timeRangeMode: "dashboard",
            maxRows: 1000,
          }}
          resolvedValue={{
            connectionRef: {
              id: 5,
              typeId: "binance-usdm",
            },
            query: {
              symbols: ["BTCUSDT"],
            },
            timeRangeMode: "dashboard",
            maxRows: 1000,
          }}
          onChange={() => {}}
          connectionInstance={connectionInstance}
          connectionType={connectionType}
          dashboardState={dashboardState}
          showConnectionPicker={false}
          showQueryEditor={false}
          connectionPathSettings={null}
        />,
      );
      await flushEffects();
    });

    const requestPreview = Array.from(container.querySelectorAll("pre")).find((entry) =>
      entry.textContent?.includes('"connectionId": 5'),
    );

    expect(requestPreview?.textContent).toContain("BTCUSDT");
    expect(requestPreview?.textContent).toContain('"interval": "1m"');
    expect(requestPreview?.textContent).not.toContain("ACTIVECELLVALUE");
    expect(requestPreview?.textContent).not.toContain("TABLE-D8BA1F58");
  });

  it("builds the request preview from resolved reference-backed connection selection", async () => {
    await act(async () => {
      root.render(
        <ConnectionQueryWorkbench
          value={{
            connectionRef: {
              id: "$(CONNECTION-SELECTOR).props.connectionId",
              typeId: "binance-usdm",
            },
            queryModelId: "binance-usdm-futures-ohlc",
            query: {
              kind: "binance-usdm-futures-ohlc",
              symbols: ["BTCUSDT"],
              interval: "1m",
            },
            timeRangeMode: "dashboard",
            maxRows: 1000,
          }}
          resolvedValue={{
            connectionRef: {
              id: 5,
              typeId: "binance-usdm",
            },
            queryModelId: "binance-usdm-futures-ohlc",
            query: {
              kind: "binance-usdm-futures-ohlc",
              symbols: ["BTCUSDT"],
              interval: "1m",
            },
            timeRangeMode: "dashboard",
            maxRows: 1000,
          }}
          onChange={() => {}}
          connectionType={connectionType}
          dashboardState={dashboardState}
          showConnectionPicker={false}
          showQueryEditor={false}
          connectionPathSettings={null}
        />,
      );
      await flushEffects();
    });

    const requestPreview = Array.from(container.querySelectorAll("pre")).find((entry) =>
      entry.textContent?.includes('"connectionId": 5'),
    );

    expect(requestPreview?.textContent).toContain('"connectionId": 5');
    expect(requestPreview?.textContent).not.toContain("CONNECTION-SELECTOR");
  });
});
