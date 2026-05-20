import { describe, expect, it } from "vitest";

import { mockApiConnection } from "@/connections/mock-api";
import {
  MOCK_API_CONNECTION_TYPE_ID,
  MOCK_API_LOCAL_INSTANCE_ID,
  MOCK_API_QUERY_KIND,
} from "@/connections/mock-api-contract";
import { createRuntimeDataStore, materializeRuntimeTabularFrame } from "@/widgets/shared/runtime-data-store";

import {
  assetScreenerDefaultProps,
  resolveAssetScreenerState,
} from "../../../../extensions/main_sequence/extensions/markets/widgets/asset-screener/assetScreenerModel";
import {
  executeConnectionQueryWidgetRequest,
  normalizeConnectionQueryProps,
} from "./connectionQueryModel";

describe("normalizeConnectionQueryProps", () => {
  it("preserves legacy uid-based connection refs for saved widgets", () => {
    const normalized = normalizeConnectionQueryProps({
      connectionRef: {
        uid: "42",
        typeId: "finance.binance-market-data",
      },
      queryModelId: "binance-spot-prices",
      query: {
        kind: "binance-spot-prices",
      },
    } as unknown as Parameters<typeof normalizeConnectionQueryProps>[0]);

    expect(normalized.connectionRef).toEqual({
      id: 42,
      typeId: "finance.binance-market-data",
    });
    expect(normalized.queryModelId).toBe("binance-spot-prices");
  });
});

describe("executeConnectionQueryWidgetRequest", () => {
  it("preserves mock tabular-frame metadata for Asset Screener source columns", async () => {
    const responseBody = {
      status: "ready",
      columns: [
        "unique_identifier",
        "Symbol",
        "sector",
        "last_price",
        "previous_close",
      ],
      rows: [
        {
          unique_identifier: "uid:BTCUSDT",
          Symbol: "BTCUSDT",
          sector: "Layer 1",
          last_price: 109420,
          previous_close: 107980,
        },
      ],
      meta: {
        marketAsset: {
          role: "snapshot",
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
            { field: "sector", role: "sector" },
            { field: "last_price", role: "value", valueKey: "price" },
            {
              field: "previous_close",
              role: "referenceValue",
              referenceKey: "previousClose",
              valueKey: "price",
            },
          ],
        },
        tableVisuals: {
          columns: {
            Symbol: { label: "Symbol" },
            sector: { label: "Sector" },
            last_price: { label: "Last", format: "price" },
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
            },
          },
        },
      },
    };
    const store = createRuntimeDataStore("mock-api-asset-screener-test");
    const runtimeState = await executeConnectionQueryWidgetRequest(
      {
        connectionRef: {
          id: MOCK_API_LOCAL_INSTANCE_ID,
          typeId: MOCK_API_CONNECTION_TYPE_ID,
        },
        queryModelId: MOCK_API_QUERY_KIND,
        query: {
          kind: MOCK_API_QUERY_KIND,
          responseMode: "auto",
          responseBody,
        },
      },
      undefined,
      mockApiConnection.queryModels![0],
      {
        ownerId: "connection-query-test",
        runtimeDataStore: store,
      },
    );
    const frame = materializeRuntimeTabularFrame(runtimeState, store);
    const state = resolveAssetScreenerState({
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData: frame,
      },
    });

    expect(frame?.meta?.tableVisuals).toMatchObject(responseBody.meta.tableVisuals);
    expect(state.columns.map((column) => column.id)).toEqual([
      "Symbol",
      "sector",
      "last_price",
      "previous_close",
      "one_day_return",
    ]);
  });
});
