import { describe, expect, it } from "vitest";

import {
  formatConnectionQueryModelTransportLabel,
  resolveConnectionQueryModelDescription,
  type ConnectionQueryModel,
} from "@/connections/types";

describe("formatConnectionQueryModelTransportLabel", () => {
  it("labels non-streamable query models as HTTP only", () => {
    const queryModel: ConnectionQueryModel = {
      id: "binance-spot-prices",
      label: "Spot Prices",
      outputContracts: ["core.tabular_frame@v1"],
    };

    expect(formatConnectionQueryModelTransportLabel(queryModel)).toBe("HTTP");
  });

  it("labels websocket-streamable query models as WS", () => {
    const queryModel: ConnectionQueryModel = {
      id: "binance-spot-ohlc",
      label: "Spot OHLC",
      outputContracts: ["core.tabular_frame@v1"],
      stream: {
        transport: "websocket",
        modes: ["snapshot", "delta"],
        defaultMode: "snapshot",
      },
    };

    expect(formatConnectionQueryModelTransportLabel(queryModel)).toBe("WS");
  });

  it("prefers stream descriptions during stream authoring", () => {
    const queryModel: ConnectionQueryModel = {
      id: "binance-spot-ohlc",
      label: "Spot OHLC",
      description: "Fetch spot OHLCV bars from /api/v3/klines.",
      outputContracts: ["core.tabular_frame@v1"],
      stream: {
        transport: "websocket",
        modes: ["snapshot", "delta"],
        defaultMode: "snapshot",
        description: "Subscribe to spot OHLCV updates over the backend WebSocket bridge.",
      },
    };

    expect(resolveConnectionQueryModelDescription(queryModel, "query")).toBe(
      "Fetch spot OHLCV bars from /api/v3/klines.",
    );
    expect(resolveConnectionQueryModelDescription(queryModel, "stream")).toBe(
      "Subscribe to spot OHLCV updates over the backend WebSocket bridge.",
    );
  });
});
