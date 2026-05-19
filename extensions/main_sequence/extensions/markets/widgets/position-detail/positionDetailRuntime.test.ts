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
});
