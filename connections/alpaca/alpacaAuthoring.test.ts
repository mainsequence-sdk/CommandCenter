import { describe, expect, it } from "vitest";

import {
  buildConnectionQueryDraftSeed,
  resolveConnectionAuthoringQueryModels,
} from "@/connections/connectionAuthoringContract";
import type { ConnectionInstance } from "@/connections/types";

import alpacaMarketDataConnection, {
  ALPACA_MARKET_DATA_CONNECTION_TYPE_ID,
} from "./index";

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
      feed: "iex",
      cryptoLocation: "us",
      webSocketStockFeed: "iex",
      webSocketCryptoLocation: "us",
    },
    secureFields: {},
    status: "ok",
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
  };
}

describe("alpaca authoring defaults", () => {
  it("keeps live query kinds off the HTTP authoring surface", () => {
    const queryModels = resolveConnectionAuthoringQueryModels({
      connectionInstance: createConnectionInstance(),
      connectionType: alpacaMarketDataConnection,
      authoringMode: "query",
    });

    expect(queryModels.some((model) => model.id.includes("-live-"))).toBe(false);
    expect(queryModels.some((model) => model.id === "alpaca-equity-ohlc")).toBe(true);
  });

  it("exposes only live query kinds on the WS authoring surface", () => {
    const queryModels = resolveConnectionAuthoringQueryModels({
      connectionInstance: createConnectionInstance(),
      connectionType: alpacaMarketDataConnection,
      authoringMode: "stream",
    });

    expect(queryModels.length).toBeGreaterThan(0);
    expect(queryModels.every((model) => model.id.includes("-live-"))).toBe(true);
    expect(queryModels.some((model) => model.id === "alpaca-equity-live-trades")).toBe(true);
  });

  it("seeds stream drafts from the live query models instead of the HTTP defaults", () => {
    const streamDraft = buildConnectionQueryDraftSeed({
      authoringMode: "stream",
      connectionInstance: createConnectionInstance(),
      connectionType: alpacaMarketDataConnection,
    });

    expect(streamDraft.queryModelId).toBe("alpaca-equity-live-trades");
    expect(streamDraft.query).toEqual({
      kind: "alpaca-equity-live-trades",
      symbols: [],
      feed: "iex",
    });
    expect(streamDraft.timeRangeMode).toBe("none");
    expect(streamDraft.fixedStartMs).toBeUndefined();
    expect(streamDraft.fixedEndMs).toBeUndefined();
  });

  it("switches defaults to crypto when the connection disables equities", () => {
    const queryDraft = buildConnectionQueryDraftSeed({
      connectionInstance: createConnectionInstance(["crypto"]),
      connectionType: alpacaMarketDataConnection,
    });
    const streamDraft = buildConnectionQueryDraftSeed({
      authoringMode: "stream",
      connectionInstance: createConnectionInstance(["crypto"]),
      connectionType: alpacaMarketDataConnection,
    });

    expect(queryDraft.queryModelId).toBe("alpaca-crypto-ohlc");
    expect(streamDraft.queryModelId).toBe("alpaca-crypto-live-trades");
  });
});
