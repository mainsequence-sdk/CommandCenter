import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPositionDetailInlineDisplayRows,
  getAllowedPositionDetailPositionTypes,
  hydratePositionDetailRowsFromPayload,
  normalizePositionDetailHoldingsDate,
  normalizePositionDetailPersistedRows,
  normalizePositionDetailSourceType,
  type PositionDetailInlineRow,
} from "./positionDetailRuntime";

describe("positionDetailRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps legacy inline widgets to target_position source type", () => {
    expect(
      normalizePositionDetailSourceType({
        dataMode: "inline",
      }),
    ).toBe("target_position");

    expect(
      normalizePositionDetailSourceType({
        sourceType: "account",
      }),
    ).toBe("account");
    expect(
      normalizePositionDetailSourceType({
        sourceType: "target_positions_account",
      }),
    ).toBe("target_positions_account");
  });

  it("restricts allowed position types by source type", () => {
    expect(getAllowedPositionDetailPositionTypes("portfolio")).toEqual([
      "weight_notional_exposure",
    ]);
    expect(getAllowedPositionDetailPositionTypes("account")).toEqual(["units"]);
    expect(getAllowedPositionDetailPositionTypes("target_position")).toEqual([
      "weight_notional_exposure",
      "units",
      "constant_notional",
    ]);
    expect(getAllowedPositionDetailPositionTypes("target_positions_account")).toEqual([
      "weight_notional_exposure",
      "units",
      "constant_notional",
    ]);
  });

  it("normalizes persisted rows and coerces position type by source contract", () => {
    const portfolioRows = normalizePositionDetailPersistedRows({
      sourceType: "portfolio",
      positionRows: [
        {
          rowId: "alpha",
          assetId: "42",
          assetName: " US 10Y Note ",
          assetTicker: " UST10Y ",
          uniqueIdentifier: " US91282CLM67 ",
          figi: " BBG00L0J2D82 ",
          date: "2026-05-17T00:00:00Z",
          positionType: "constant_notional",
          positionValue: "2500000",
        },
      ] as unknown as PositionDetailInlineRow[],
    });

    expect(portfolioRows).toEqual([
      {
        rowId: "alpha",
        assetId: 42,
        assetName: "US 10Y Note",
        assetTicker: "UST10Y",
        uniqueIdentifier: "US91282CLM67",
        figi: "BBG00L0J2D82",
        date: "2026-05-17",
        price: null,
        positionType: "weight_notional_exposure",
        positionValue: 2500000,
      },
    ]);

    const accountRows = normalizePositionDetailPersistedRows({
      sourceType: "account",
      positionRows: [
        {
          assetId: 7,
          positionType: "future_usdm",
        },
      ] as unknown as PositionDetailInlineRow[],
    });

    expect(accountRows).toEqual([
      {
        rowId: "position-row-7-1",
        assetId: 7,
        assetName: undefined,
        assetTicker: undefined,
        uniqueIdentifier: undefined,
        figi: undefined,
        price: null,
        positionType: "units",
        positionValue: 0,
      },
    ]);

    expect(buildPositionDetailInlineDisplayRows(accountRows, "account")).toEqual([
      {
        id: 7,
        asset_id: 7,
        asset_name: "Asset 7",
        asset_ticker: null,
        unique_identifier: null,
        figi: null,
        position_value: 0,
      },
    ]);

    const targetPositionsAccountRows = normalizePositionDetailPersistedRows({
      sourceType: "target_positions_account",
      positionRows: [
        {
          assetId: 9,
          positionType: "constant_notional",
          date: "2026-05-17",
          positionValue: 2500,
        },
      ] as unknown as PositionDetailInlineRow[],
    });

    expect(targetPositionsAccountRows).toEqual([
      {
        rowId: "position-row-9-1",
        assetId: 9,
        assetName: undefined,
        assetTicker: undefined,
        uniqueIdentifier: undefined,
        figi: undefined,
        price: null,
        positionType: "constant_notional",
        positionValue: 2500,
      },
    ]);
  });

  it("forces account position types back to units", () => {
    expect(
      normalizePositionDetailPersistedRows({
        sourceType: "account",
        positionRows: [
          {
            assetId: 7,
            positionType: "future_usdm",
          },
        ] as unknown as PositionDetailInlineRow[],
      }),
    ).toEqual([
      {
        rowId: "position-row-7-1",
        assetId: 7,
        assetName: undefined,
        assetTicker: undefined,
        uniqueIdentifier: undefined,
        figi: undefined,
        price: null,
        positionType: "units",
        positionValue: 0,
      },
    ]);
  });

  it("normalizes account rows keyed only by unique identifier", () => {
    const rows = normalizePositionDetailPersistedRows({
      sourceType: "account",
      positionRows: [
        {
          rowId: "uid-only-btc",
          uniqueIdentifier: "example-asset-btc",
          positionValue: "10",
        },
      ] as unknown as PositionDetailInlineRow[],
    });

    expect(rows).toEqual([
      {
        rowId: "uid-only-btc",
        assetId: 1000000001,
        assetName: undefined,
        assetTicker: undefined,
        uniqueIdentifier: "example-asset-btc",
        figi: undefined,
        price: null,
        positionType: "units",
        positionValue: 10,
      },
    ]);

    expect(buildPositionDetailInlineDisplayRows(rows, "account")).toEqual([
      {
        id: 1000000001,
        asset_id: 1000000001,
        asset_name: "example-asset-btc",
        asset_ticker: null,
        unique_identifier: "example-asset-btc",
        figi: "example-asset-btc",
        position_value: 10,
      },
    ]);
  });

  it("normalizes account holdings dates to timezone-aware ISO timestamps", () => {
    expect(normalizePositionDetailHoldingsDate("2026-05-18")).toBe("2026-05-18T00:00:00.000Z");
    expect(normalizePositionDetailHoldingsDate("2026-05-18T14:30:00Z")).toBe(
      "2026-05-18T14:30:00.000Z",
    );
  });

  it("hydrates editable rows from runtime payload using source type rules", () => {
    expect(
      hydratePositionDetailRowsFromPayload(
        {
          weights: null,
          position_columns: [],
          rows: [
            {
              asset_id: 5,
              asset_name: "Apple Inc.",
              asset_ticker: "AAPL",
              unique_identifier: "US0378331005",
              figi: "BBG000B9XRY4",
              as_of_date: "2026-05-16T08:30:00Z",
              position_type: "constant_notional",
              position_value: 125,
            },
          ],
          columnDefs: [],
          summaryColumnDefs: [],
          position_map: null,
          weights_date: "2026-05-18T09:30:00Z",
        },
        "portfolio",
      ),
    ).toEqual([
      {
        rowId: "hydrated-position-5-1",
        assetId: 5,
        assetName: "Apple Inc.",
        assetTicker: "AAPL",
        uniqueIdentifier: "US0378331005",
        figi: "BBG000B9XRY4",
        date: "2026-05-18",
        price: null,
        positionType: "weight_notional_exposure",
        positionValue: 125,
      },
    ]);
  });

  it("hydrates account rows using the holdings snapshot date instead of per-row time_index", () => {
    expect(
      hydratePositionDetailRowsFromPayload(
        {
          weights: null,
          position_columns: [],
          rows: [
            {
              asset_id: 101,
              asset_name: "btc_spot",
              unique_identifier: "btc_spot",
              time_index: "2026-05-17T08:30:00Z",
              price: "100.000000000000000000",
              position_type: "future_usdm",
              position_value: "12.00000000",
            },
          ],
          columnDefs: [],
          summaryColumnDefs: [],
          position_map: null,
          weights_date: "2026-05-18T09:30:00Z",
        },
        "account",
      ),
    ).toEqual([
      {
        rowId: "hydrated-position-101-1",
        assetId: 101,
        assetName: "btc_spot",
        assetTicker: undefined,
        uniqueIdentifier: "btc_spot",
        figi: undefined,
        date: "2026-05-18",
        price: 100,
        positionType: "units",
        positionValue: 12,
      },
    ]);
  });

  it("deduplicates account holdings by unique identifier and keeps the richer row", () => {
    expect(
      hydratePositionDetailRowsFromPayload(
        {
          weights: null,
          position_columns: [],
          rows: [
            {
              asset_id: 101,
              asset_name: "Bitcoin",
              asset_ticker: "BTC",
              unique_identifier: "example-asset-btc",
              price: "100.000000000000000000",
              position_value: "10",
            },
            {
              unique_identifier: "example-asset-btc",
              position_value: "0",
            },
          ],
          columnDefs: [],
          summaryColumnDefs: [],
          position_map: null,
          weights_date: "2026-05-18T09:30:00Z",
        },
        "account",
      ),
    ).toEqual([
      {
        rowId: "hydrated-position-101-1",
        assetId: 101,
        assetName: "Bitcoin",
        assetTicker: "BTC",
        uniqueIdentifier: "example-asset-btc",
        figi: undefined,
        date: "2026-05-18",
        price: 100,
        positionType: "units",
        positionValue: 10,
      },
    ]);
  });

  it("deduplicates account holdings by asset uid when numeric ids are unavailable", () => {
    expect(
      hydratePositionDetailRowsFromPayload(
        {
          weights: null,
          position_columns: [],
          rows: [
            {
              unique_identifier: "example-asset-btc",
              asset: {
                uid: "asset-btc",
                unique_identifier: "example-asset-btc",
                current_snapshot: {
                  name: "Bitcoin",
                  ticker: "BTC",
                },
              },
              position_value: "10",
            },
            {
              asset_uid: "asset-btc",
              unique_identifier: "example-asset-btc-duplicate",
              position_value: "0",
            },
          ],
          columnDefs: [],
          summaryColumnDefs: [],
          position_map: null,
          weights_date: "2026-05-18T09:30:00Z",
        },
        "account",
      ),
    ).toEqual([
      {
        rowId: "hydrated-position-1000000001-1",
        assetId: 1000000001,
        assetUid: "asset-btc",
        assetName: "Bitcoin",
        assetTicker: "BTC",
        uniqueIdentifier: "example-asset-btc",
        figi: undefined,
        date: "2026-05-18",
        price: null,
        positionType: "units",
        positionValue: 10,
      },
    ]);
  });

  it("hydrates target positions account rows from the canonical target-position payload", () => {
    expect(
      hydratePositionDetailRowsFromPayload(
        {
          weights: null,
          position_columns: [],
          rows: [
            {
              unique_identifier: "ASSET:BTC",
              asset_name: "Bitcoin spot",
              asset_ticker: "BTC",
              position_type: "weight_notional_exposure",
              position_value: "0.550000000000000000",
            },
            {
              unique_identifier: "ASSET:ETH",
              asset_name: "Ethereum spot",
              asset_ticker: "ETH",
              position_type: "units",
              position_value: "3.000000000000000000",
            },
          ],
          columnDefs: [],
          summaryColumnDefs: [],
          position_map: null,
          weights_date: "2026-05-19T10:30:00Z",
        },
        "target_positions_account",
      ),
    ).toEqual([
      {
        rowId: "hydrated-position-1000000001-1",
        assetId: 1000000001,
        assetName: "Bitcoin spot",
        assetTicker: "BTC",
        uniqueIdentifier: "ASSET:BTC",
        figi: undefined,
        date: "2026-05-19",
        price: null,
        positionType: "weight_notional_exposure",
        positionValue: 0.55,
      },
      {
        rowId: "hydrated-position-1000000002-2",
        assetId: 1000000002,
        assetName: "Ethereum spot",
        assetTicker: "ETH",
        uniqueIdentifier: "ASSET:ETH",
        figi: undefined,
        date: "2026-05-19",
        price: null,
        positionType: "units",
        positionValue: 3,
      },
    ]);
  });
});
