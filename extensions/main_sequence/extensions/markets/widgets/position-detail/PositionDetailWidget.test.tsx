/** @vitest-environment jsdom */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiMocks = vi.hoisted(() => ({
  fetchManagedAccountHoldingsByFundPositionDetails: vi.fn(),
}));

vi.mock("../../../../common/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../common/api")>();

  return {
    ...actual,
    fetchManagedAccountHoldingsByFundPositionDetails:
      apiMocks.fetchManagedAccountHoldingsByFundPositionDetails,
  };
});

import { positionDetailWidget } from "./definition";
import {
  buildManagedAccountTargetPositionsPayload,
  PositionDetailWidget,
} from "./PositionDetailWidget";

vi.mock("@/dashboards/DashboardWidgetExecution", () => ({
  useWidgetExecutionState: vi.fn(() => undefined),
}));

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let queryClient: QueryClient | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  host?.remove();
  queryClient?.clear();
  apiMocks.fetchManagedAccountHoldingsByFundPositionDetails.mockReset();
  root = null;
  host = null;
  queryClient = null;
});

function renderWidget(element: ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  queryClient = client;

  act(() => {
    root?.render(
      <QueryClientProvider client={client}>
        {element}
      </QueryClientProvider>,
    );
  });

  return host;
}

async function flushAsyncUpdates() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

describe("PositionDetailWidget", () => {
  it("builds the target allocation write payload with target-specific fields", () => {
    expect(
      buildManagedAccountTargetPositionsPayload(
        [
          {
            rowId: "asset-row",
            assetId: 1,
            assetUid: "asset-uid",
            targetType: "asset",
            targetUid: "asset-uid",
            targetMetadata: { source: "asset-search" },
            uniqueIdentifier: "btc_spot",
            assetName: "Bitcoin",
            positionType: "units",
            positionValue: 25,
          },
          {
            rowId: "portfolio-row",
            assetId: 2,
            portfolioUid: "portfolio-uid",
            targetType: "portfolio",
            targetUid: "portfolio-uid",
            targetMetadata: { portfolio_index_uid: "index-uid" },
            uniqueIdentifier: "core_portfolio",
            assetName: "Core Portfolio",
            positionType: "weight_notional_exposure",
            positionValue: 0.4,
          },
        ],
        "2026-06-08T10:30:00Z",
      ),
    ).toEqual({
      target_positions_date: "2026-06-08T10:30:00Z",
      overwrite: true,
      positions: [
        {
          target_type: "asset",
          target_uid: "asset-uid",
          asset_uid: "asset-uid",
          single_asset_quantity: "25",
          metadata_json: { source: "asset-search" },
        },
        {
          target_type: "portfolio",
          target_uid: "portfolio-uid",
          portfolio_uid: "portfolio-uid",
          weight_notional_exposure: "0.4",
          metadata_json: { portfolio_index_uid: "index-uid" },
        },
      ],
    });
  });

  it("rejects single asset quantity for portfolio target allocations", () => {
    expect(() =>
      buildManagedAccountTargetPositionsPayload(
        [
          {
            rowId: "portfolio-row",
            assetId: 2,
            portfolioUid: "portfolio-uid",
            targetType: "portfolio",
            targetUid: "portfolio-uid",
            assetName: "Core Portfolio",
            positionType: "units",
            positionValue: 25,
          },
        ],
        "2026-06-08T10:30:00Z",
      ),
    ).toThrow("Portfolio target allocations cannot use single asset quantity.");
  });

  it("renders caller-provided account holdings payloads without requiring an account uid", () => {
    const container = renderWidget(
      <PositionDetailWidget
        widget={positionDetailWidget}
        props={{
          editableInPlace: false,
          sourceType: "account",
          variant: "positions",
          positionRows: [],
        }}
        runtimeState={{
          status: "success",
          variant: "positions",
          payload: {
            weights: null,
            position_columns: [],
            rows: [
              {
                asset_identifier: "example-asset-btc",
                asset_name: "Bitcoin",
                asset_ticker: "BTC",
                position_value: "5.0",
                quantity: "5.0",
                direction: 1,
                signed_quantity: "5.0",
              },
            ],
            columnDefs: [
              { field: "asset_name", headerName: "Asset" },
              { field: "asset_ticker", headerName: "Ticker" },
              { field: "position_value", headerName: "Quantity" },
            ],
            summaryColumnDefs: [],
            position_map: null,
            weights_date: "2026-06-08T10:30:00Z",
          },
        }}
      />,
    );

    expect(container.textContent).toContain("Holdings Date");
    expect(container.textContent).toContain("Bitcoin");
    expect(container.textContent).not.toContain("Set a valid account uid");
  });

  it("loads and renders account holdings by fund from the by-fund tab", async () => {
    apiMocks.fetchManagedAccountHoldingsByFundPositionDetails.mockResolvedValueOnce({
      account_uid: "account-uid",
      source_account_holdings_set_uid: "source-holdings-set",
      holdings_date: "2026-06-08T10:30:00Z",
      funds: [
        {
          virtual_fund_uid: "fund-uid",
          virtual_fund_unique_identifier: "core-fund",
          target_portfolio_uid: "portfolio-uid",
          holdings_set_uid: "fund-holdings-set",
          holdings: [],
          position_details: {
            weights: {
              holdings_set_uid: "fund-holdings-set",
            },
            position_columns: [],
            rows: [
              {
                asset_identifier: "example-asset-btc",
                asset_name: "Bitcoin",
                asset_ticker: "BTC",
                quantity: "10.0",
                direction: 1,
                signed_quantity: "10.0",
                position_value: "10.0",
                position_type: "units",
                allocation: {
                  scale: "1.0",
                },
              },
            ],
            columnDefs: [
              { field: "asset_name", headerName: "Asset" },
              { field: "asset_ticker", headerName: "Ticker" },
              { field: "position_value", headerName: "Quantity" },
            ],
            summaryColumnDefs: [],
            position_map: null,
            weights_date: "2026-06-08T10:30:00Z",
          },
        },
      ],
      residuals: [
        {
          asset_identifier: "example-asset-eth",
          source_signed_quantity: "25.0",
          allocated_signed_quantity: "20.0",
          residual_signed_quantity: "5.0",
          asset: {
            uid: "asset-eth",
            asset_identifier: "example-asset-eth",
            current_snapshot: {
              name: "Ethereum",
              ticker: "ETH",
            },
          },
        },
      ],
      allocation_warnings: ["allocated asset missing from source holdings"],
    });
    const container = renderWidget(
      <PositionDetailWidget
        widget={positionDetailWidget}
        props={{
          accountUid: "account-uid",
          editableInPlace: false,
          sourceType: "account",
          variant: "positions",
          positionRows: [],
        }}
        runtimeState={{
          status: "success",
          variant: "positions",
          payload: {
            weights: null,
            position_columns: [],
            rows: [
              {
                asset_identifier: "example-asset-btc",
                asset_name: "Bitcoin",
                asset_ticker: "BTC",
                position_value: "10.0",
                quantity: "10.0",
                direction: 1,
                signed_quantity: "10.0",
              },
            ],
            columnDefs: [
              { field: "asset_name", headerName: "Asset" },
              { field: "asset_ticker", headerName: "Ticker" },
              { field: "position_value", headerName: "Quantity" },
            ],
            summaryColumnDefs: [],
            position_map: null,
            weights_date: "2026-06-08T10:30:00Z",
          },
        }}
      />,
    );

    const byFundButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "By Fund",
    );

    expect(byFundButton).toBeTruthy();

    await act(async () => {
      byFundButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushAsyncUpdates();
    await flushAsyncUpdates();

    expect(apiMocks.fetchManagedAccountHoldingsByFundPositionDetails).toHaveBeenCalledWith(
      "account-uid",
      expect.objectContaining({
        holdingsDate: "2026-06-08T10:30:00.000Z",
        includeAssetDetail: true,
        order: "desc",
      }),
    );
    expect(container.textContent).toContain("core-fund");
    expect(container.textContent).toContain("Bitcoin");
    expect(container.textContent).toContain("Residuals");
    expect(container.textContent).toContain("Ethereum");
    expect(container.textContent).toContain("allocated asset missing from source holdings");
  });
});
