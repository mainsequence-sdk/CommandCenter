import { describe, expect, it } from "vitest";

import {
  buildPortfolioWeightsInlineDisplayRows,
  normalizePortfolioWeightsDataMode,
  normalizePortfolioWeightsInlineRows,
} from "./portfolioWeightsRuntime";

describe("portfolioWeightsRuntime", () => {
  it("treats editable in place as inline mode", () => {
    expect(
      normalizePortfolioWeightsDataMode({
        editableInPlace: true,
      }),
    ).toBe("inline");

    expect(
      normalizePortfolioWeightsDataMode({
        dataMode: "inline",
      }),
    ).toBe("inline");

    expect(
      normalizePortfolioWeightsDataMode({
        editableInPlace: false,
        dataMode: "portfolio",
      }),
    ).toBe("portfolio");
  });

  it("normalizes persisted inline rows and builds display rows", () => {
    const rows = normalizePortfolioWeightsInlineRows([
      {
        rowId: "alpha",
        assetId: "42",
        assetName: " US 10Y Note ",
        assetTicker: " UST10Y ",
        uniqueIdentifier: " US91282CLM67 ",
        figi: " BBG00L0J2D82 ",
        positionType: "constant_notional",
        positionValue: "2500000",
      },
      {
        assetId: 7,
      },
      {
        assetId: 0,
      },
    ]);

    expect(rows).toEqual([
      {
        rowId: "alpha",
        assetId: 42,
        assetName: "US 10Y Note",
        assetTicker: "UST10Y",
        uniqueIdentifier: "US91282CLM67",
        figi: "BBG00L0J2D82",
        positionType: "constant_notional",
        positionValue: 2500000,
      },
      {
        rowId: "inline-position-7-2",
        assetId: 7,
        assetName: undefined,
        assetTicker: undefined,
        uniqueIdentifier: undefined,
        figi: undefined,
        positionType: "weight_notional_exposure",
        positionValue: 0,
      },
    ]);

    expect(buildPortfolioWeightsInlineDisplayRows(rows)).toEqual([
      {
        id: 42,
        asset_id: 42,
        asset_name: "US 10Y Note",
        asset_ticker: "UST10Y",
        unique_identifier: "US91282CLM67",
        figi: "BBG00L0J2D82",
        position_type: "constant_notional",
        position_value: 2500000,
      },
      {
        id: 7,
        asset_id: 7,
        asset_name: "Asset 7",
        asset_ticker: null,
        unique_identifier: null,
        figi: null,
        position_type: "weight_notional_exposure",
        position_value: 0,
      },
    ]);
  });
});
