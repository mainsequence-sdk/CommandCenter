import { describe, expect, it } from "vitest";

import { buildTargetPositionsAccountExpandedRecord } from "./PositionDetailTable";

describe("PositionDetailTable target-position expanded JSON", () => {
  it("keeps the canonical asset target-position row shape", () => {
    const assetRow = {
      target_type: "asset",
      target_uid: "1d082cff-308d-4b71-bf72-1b17dce6620b",
      asset_uid: "1d082cff-308d-4b71-bf72-1b17dce6620b",
      portfolio_uid: null,
      unique_identifier: "example-asset-btc",
      weight_notional_exposure: "0.6",
      constant_notional_exposure: null,
      single_asset_quantity: null,
      asset: {
        uid: "1d082cff-308d-4b71-bf72-1b17dce6620b",
        unique_identifier: "example-asset-btc",
        current_snapshot: {
          name: "Bitcoin",
          ticker: "BTC",
        },
      },
      portfolio: null,
      asset_name: "Bitcoin",
      asset_ticker: "BTC",
      position_type: "weight_notional_exposure",
      position_value: "0.6",
    };

    expect(buildTargetPositionsAccountExpandedRecord(assetRow)).toEqual({
      target_type: "asset",
      target_uid: "1d082cff-308d-4b71-bf72-1b17dce6620b",
      asset_uid: "1d082cff-308d-4b71-bf72-1b17dce6620b",
      portfolio_uid: null,
      unique_identifier: "example-asset-btc",
      weight_notional_exposure: "0.6",
      constant_notional_exposure: null,
      single_asset_quantity: null,
      asset: {
        uid: "1d082cff-308d-4b71-bf72-1b17dce6620b",
        unique_identifier: "example-asset-btc",
        current_snapshot: {
          name: "Bitcoin",
          ticker: "BTC",
        },
      },
      portfolio: null,
    });
  });

  it("keeps the canonical portfolio target-position row shape", () => {
    const portfolioRow = {
      target_type: "portfolio",
      target_uid: "portfolio-uid",
      asset_uid: null,
      portfolio_uid: "portfolio-uid",
      unique_identifier: "example-sleeve",
      weight_notional_exposure: "0.4",
      constant_notional_exposure: null,
      single_asset_quantity: null,
      asset: null,
      portfolio: {
        uid: "portfolio-uid",
        unique_identifier: "example-sleeve",
        portfolio_index_uid: null,
      },
      asset_name: "example-sleeve",
      position_type: "weight_notional_exposure",
      position_value: "0.4",
    };

    expect(buildTargetPositionsAccountExpandedRecord(portfolioRow)).toEqual({
      target_type: "portfolio",
      target_uid: "portfolio-uid",
      asset_uid: null,
      portfolio_uid: "portfolio-uid",
      unique_identifier: "example-sleeve",
      weight_notional_exposure: "0.4",
      constant_notional_exposure: null,
      single_asset_quantity: null,
      asset: null,
      portfolio: {
        uid: "portfolio-uid",
        unique_identifier: "example-sleeve",
        portfolio_index_uid: null,
      },
    });
  });
});
