import { describe, expect, it } from "vitest";

import { normalizeConnectionQueryProps } from "./connectionQueryModel";

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
