import { describe, expect, it } from "vitest";

import { buildConnectionStreamQueryExecutionKey } from "./ConnectionStreamQueryWidget";

describe("buildConnectionStreamQueryExecutionKey", () => {
  it("stays stable across equivalent prop and request objects", () => {
    const firstKey = buildConnectionStreamQueryExecutionKey({
      instanceId: "stream-1",
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-aggregate-trades",
        query: {
          kind: "binance-usdm-futures-aggregate-trades",
          symbols: ["BTCUSDT"],
        },
        mergeKeyFields: ["aggregateTradeId", "symbol", "marketType"],
        retentionMaxRows: 500,
      },
      queryModel: {
        id: "binance-usdm-futures-aggregate-trades",
        stream: {
          transport: "websocket",
          modes: ["snapshot", "delta"],
          defaultMode: "snapshot",
        },
      },
      request: {
        connectionId: 5,
        query: {
          kind: "binance-usdm-futures-aggregate-trades",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: "core.tabular_frame@v1",
      },
      validationError: null,
    });
    const secondKey = buildConnectionStreamQueryExecutionKey({
      instanceId: "stream-1",
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-aggregate-trades",
        query: {
          kind: "binance-usdm-futures-aggregate-trades",
          symbols: ["BTCUSDT"],
        },
        mergeKeyFields: ["aggregateTradeId", "symbol", "marketType"],
        retentionMaxRows: 500,
      },
      queryModel: {
        id: "binance-usdm-futures-aggregate-trades",
        stream: {
          transport: "websocket",
          modes: ["snapshot", "delta"],
          defaultMode: "snapshot",
        },
      },
      request: {
        connectionId: 5,
        query: {
          kind: "binance-usdm-futures-aggregate-trades",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: "core.tabular_frame@v1",
      },
      validationError: null,
    });

    expect(secondKey).toBe(firstKey);
  });

  it("changes when runtime-relevant stream props change", () => {
    const baseInput = {
      instanceId: "stream-1",
      props: {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-aggregate-trades",
        query: {
          kind: "binance-usdm-futures-aggregate-trades",
          symbols: ["BTCUSDT"],
        },
        mergeKeyFields: ["aggregateTradeId", "symbol", "marketType"],
        retentionMaxRows: 500,
      },
      queryModel: {
        id: "binance-usdm-futures-aggregate-trades",
        stream: {
          transport: "websocket",
          modes: ["snapshot", "delta"],
          defaultMode: "snapshot",
        },
      },
      request: {
        connectionId: 5,
        query: {
          kind: "binance-usdm-futures-aggregate-trades",
          symbols: ["BTCUSDT"],
        },
        requestedOutputContract: "core.tabular_frame@v1",
      },
      validationError: null,
    };

    const baseKey = buildConnectionStreamQueryExecutionKey(baseInput);
    const nextMergeKey = buildConnectionStreamQueryExecutionKey({
      ...baseInput,
      props: {
        ...baseInput.props,
        mergeKeyFields: ["symbol"],
      },
    });
    const nextRequestKey = buildConnectionStreamQueryExecutionKey({
      ...baseInput,
      request: {
        ...baseInput.request,
        query: {
          kind: "binance-usdm-futures-aggregate-trades",
          symbols: ["ETHUSDT"],
        },
      },
    });

    expect(nextMergeKey).not.toBe(baseKey);
    expect(nextRequestKey).not.toBe(baseKey);
  });
});
