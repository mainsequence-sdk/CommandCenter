import { describe, expect, it } from "vitest";

import { resolveConnectionStreamAuthoringQueryModels } from "@/connections/connectionAuthoringContract";
import type { ConnectionInstance } from "@/connections/types";

import alpacaMarketDataConnection, {
  ALPACA_MARKET_DATA_CONNECTION_TYPE_ID,
} from "./index";

const expectedStreamableQueryModelIds = [
  "alpaca-equity-live-trades",
  "alpaca-equity-live-quotes",
  "alpaca-equity-live-bars",
  "alpaca-crypto-live-trades",
  "alpaca-crypto-live-quotes",
  "alpaca-crypto-live-bars",
];

function createConnectionInstance(
  assetClasses: Array<"us_equity" | "crypto"> = ["us_equity", "crypto"],
): ConnectionInstance {
  return {
    id: 42,
    typeId: ALPACA_MARKET_DATA_CONNECTION_TYPE_ID,
    typeVersion: alpacaMarketDataConnection.version,
    name: "Alpaca Production",
    publicConfig: {
      assetClasses,
    },
    secureFields: {},
    status: "ok",
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
  };
}

describe("alpacaMarketDataConnection", () => {
  it("advertises the backend-approved stream capability and live query models", () => {
    expect(alpacaMarketDataConnection.capabilities).toContain("stream");

    const queryModels = alpacaMarketDataConnection.queryModels ?? [];
    const streamableIds = queryModels
      .filter((model) => model.stream)
      .map((model) => model.id)
      .sort();

    expect(streamableIds).toEqual([...expectedStreamableQueryModelIds].sort());

    for (const queryModelId of expectedStreamableQueryModelIds) {
      const model = queryModels.find((entry) => entry.id === queryModelId);

      expect(model?.stream).toEqual({
        transport: "websocket",
        modes: ["delta"],
        defaultMode: "delta",
        supportsResume: false,
        heartbeatMs: 30_000,
        defaultMergeKeyFields: expect.any(Array),
        description: expect.any(String),
      });
    }

    expect(
      queryModels.find((entry) => entry.id === "alpaca-equity-ohlc")?.stream,
    ).toBeUndefined();
    expect(
      queryModels.find((entry) => entry.id === "alpaca-crypto-latest-trades")?.stream,
    ).toBeUndefined();
  });

  it("publishes the websocket public config fields expected by the backend adapter", () => {
    const fieldIds = alpacaMarketDataConnection.publicConfigSchema.fields.map((field) => field.id);

    expect(fieldIds).toEqual(
      expect.arrayContaining([
        "webSocketBaseUrl",
        "webSocketSandboxBaseUrl",
        "webSocketUseSandbox",
        "webSocketStockFeed",
        "webSocketCryptoLocation",
        "webSocketAuthTimeoutMs",
        "webSocketProviderConnectionLimitPerEndpoint",
      ]),
    );
  });

  it("exposes the live query models through shared stream authoring", () => {
    const models = resolveConnectionStreamAuthoringQueryModels({
      connectionInstance: createConnectionInstance(),
      connectionType: alpacaMarketDataConnection,
    });

    expect(models.map((model) => model.id).sort()).toEqual(
      [...expectedStreamableQueryModelIds].sort(),
    );
  });

  it("publishes stream preview graph hints for the live models", () => {
    const queryModels = alpacaMarketDataConnection.queryModels ?? [];

    expect(
      queryModels.find((entry) => entry.id === "alpaca-equity-live-trades")?.preview?.graph,
    ).toMatchObject({
      xField: "timestamp",
      yField: "price",
      groupField: "symbol",
      rowIdentityFields: ["timestamp", "symbol", "tradeId", "assetClass"],
    });
    expect(
      queryModels.find((entry) => entry.id === "alpaca-equity-live-bars")?.stream
        ?.defaultMergeKeyFields,
    ).toEqual(["timestamp", "symbol", "timeframe", "barType", "assetClass"]);
    expect(
      queryModels.find((entry) => entry.id === "alpaca-crypto-live-quotes")?.preview?.graph,
    ).toMatchObject({
      xField: "timestamp",
      yField: "bidPrice",
      groupField: "symbol",
      rowIdentityFields: ["timestamp", "symbol", "assetClass"],
    });
  });
});
