import { describe, expect, it } from "vitest";

import { resolveConnectionStreamAuthoringQueryModels } from "@/connections/connectionAuthoringContract";
import type { ConnectionInstance } from "@/connections/types";

import binanceMarketDataConnection, {
  BINANCE_MARKET_DATA_CONNECTION_TYPE_ID,
} from "./index";

const expectedStreamableQueryModelIds = [
  "binance-spot-ohlc",
  "binance-spot-recent-trades",
  "binance-spot-aggregate-trades",
  "binance-usdm-futures-ohlc",
  "binance-usdm-futures-aggregate-trades",
];

function createConnectionInstance(): ConnectionInstance {
  return {
    id: 42,
    typeId: BINANCE_MARKET_DATA_CONNECTION_TYPE_ID,
    typeVersion: binanceMarketDataConnection.version,
    name: "Binance Production",
    publicConfig: {
      marketTypes: ["spot", "usdm_futures"],
    },
    secureFields: {},
    status: "ok",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  };
}

describe("binanceMarketDataConnection", () => {
  it("advertises the backend-approved stream capability and query models", () => {
    expect(binanceMarketDataConnection.capabilities).toContain("stream");

    const queryModels = binanceMarketDataConnection.queryModels ?? [];
    const streamableIds = queryModels
      .filter((model) => model.stream)
      .map((model) => model.id)
      .sort();

    expect(streamableIds).toEqual([...expectedStreamableQueryModelIds].sort());

    for (const queryModelId of expectedStreamableQueryModelIds) {
      const model = queryModels.find((entry) => entry.id === queryModelId);

      expect(model?.stream).toEqual({
        transport: "websocket",
        modes: ["snapshot", "delta"],
        defaultMode: "snapshot",
        defaultMergeKeyFields: expect.any(Array),
        description: expect.any(String),
      });
      expect(model?.stream?.description?.trim().length).toBeGreaterThan(0);
    }

    expect(
      queryModels.find((entry) => entry.id === "binance-spot-prices")?.stream,
    ).toBeUndefined();
    expect(
      queryModels.find((entry) => entry.id === "binance-usdm-futures-prices")?.stream,
    ).toBeUndefined();
    expect(
      queryModels.find((entry) => entry.id === "binance-usdm-futures-recent-trades")?.stream,
    ).toBeUndefined();
  });

  it("publishes the websocket public config fields expected by the backend adapter", () => {
    const fieldIds = binanceMarketDataConnection.publicConfigSchema.fields.map((field) => field.id);

    expect(fieldIds).toEqual(
      expect.arrayContaining([
        "spotWebSocketBaseUrl",
        "spotWebSocketMarketDataBaseUrl",
        "usdmFuturesWebSocketBaseUrl",
        "webSocketCombinedStreams",
        "webSocketTimeUnit",
        "webSocketReconnectBeforeSeconds",
        "webSocketMaxStreamsPerProviderConnection",
        "webSocketIncomingMessageLimitPerSecond",
      ]),
    );
  });

  it("exposes only backend-approved streamable query models through shared authoring", () => {
    const models = resolveConnectionStreamAuthoringQueryModels({
      connectionInstance: createConnectionInstance(),
      connectionType: binanceMarketDataConnection,
    });

    expect(models.map((model) => model.id).sort()).toEqual(
      [...expectedStreamableQueryModelIds].sort(),
    );
  });

  it("publishes stream preview graph hints for the streamed market-data models", () => {
    const queryModels = binanceMarketDataConnection.queryModels ?? [];

    expect(
      queryModels.find((entry) => entry.id === "binance-spot-ohlc")?.preview?.graph,
    ).toMatchObject({
      xField: "openTime",
      yField: "close",
      groupField: "symbol",
      rowIdentityFields: ["openTime", "symbol", "interval", "marketType"],
    });
    expect(
      queryModels.find((entry) => entry.id === "binance-spot-recent-trades")?.preview?.graph,
    ).toMatchObject({
      xField: "time",
      yField: "price",
      groupField: "symbol",
      rowIdentityFields: ["tradeId", "symbol", "marketType"],
    });
    expect(
      queryModels.find((entry) => entry.id === "binance-spot-aggregate-trades")?.preview?.graph,
    ).toMatchObject({
      xField: "time",
      yField: "price",
      groupField: "symbol",
      rowIdentityFields: ["aggregateTradeId", "symbol", "marketType"],
    });
    expect(
      queryModels.find((entry) => entry.id === "binance-usdm-futures-aggregate-trades")?.stream
        ?.defaultMergeKeyFields,
    ).toEqual(["aggregateTradeId", "symbol", "marketType"]);
  });
});
