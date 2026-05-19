import { describe, expect, it, vi } from "vitest";

import {
  executePortfolioWeightsWidget,
  portfolioWeightsExecutionDefinition,
} from "./portfolioWeightsExecution";

const { fetchManagedAccountHoldingsPositionDetails, fetchTargetPortfolioWeightsPositionDetails } = vi.hoisted(() => ({
  fetchManagedAccountHoldingsPositionDetails: vi.fn(),
  fetchTargetPortfolioWeightsPositionDetails: vi.fn(),
}));

vi.mock("../../../../common/api", () => ({
  fetchManagedAccountHoldingsPositionDetails,
  fetchTargetPortfolioWeightsPositionDetails,
}));

describe("portfolioWeightsExecution", () => {
  it("does not execute backend loading for target position sources", async () => {
    const result = await executePortfolioWeightsWidget({
      props: {
        sourceType: "target_position",
        editableInPlace: true,
        positionRows: [],
      },
      runtimeState: undefined,
      instanceId: "portfolio-weights-account",
      widgetId: "portfolio-weights-table",
    } as never);

    expect(fetchTargetPortfolioWeightsPositionDetails).not.toHaveBeenCalled();
    expect(fetchManagedAccountHoldingsPositionDetails).not.toHaveBeenCalled();
    expect(result.status).toBe("skipped");
    expect(result.runtimeStatePatch).toMatchObject({
      status: "idle",
      variant: "positions",
      payload: undefined,
    });
  });

  it("does not execute backend loading once local rows exist", () => {
    expect(
      portfolioWeightsExecutionDefinition.canExecute({
        props: {
          sourceType: "portfolio",
          portfolioId: 123,
          positionRows: [
            {
              rowId: "local-1",
              assetId: 10,
              date: "2026-05-18",
              positionType: "weight_notional_exposure",
              positionValue: 0.25,
            },
          ],
        },
      } as never),
    ).toBe(false);
  });

  it("still executes hydrated portfolio mode when no local rows exist", () => {
    expect(
      portfolioWeightsExecutionDefinition.canExecute({
        props: {
          sourceType: "portfolio",
          portfolioId: 123,
          positionRows: [],
        },
      } as never),
    ).toBe(true);
  });

  it("executes hydrated account mode when no local rows exist", async () => {
    fetchManagedAccountHoldingsPositionDetails.mockResolvedValueOnce({
      weights: null,
      position_columns: [],
      rows: [],
      columnDefs: [],
      summaryColumnDefs: [],
      position_map: null,
      weights_date: "2026-05-18T09:30:00Z",
    });

    const result = await executePortfolioWeightsWidget({
      props: {
        sourceType: "account",
        accountId: 26,
        editableInPlace: true,
        positionRows: [],
      },
      runtimeState: undefined,
      instanceId: "portfolio-weights-account",
      widgetId: "portfolio-weights-table",
    } as never);

    expect(fetchManagedAccountHoldingsPositionDetails).toHaveBeenCalledWith(26, {
      traceMeta: undefined,
    });
    expect(result.status).toBe("success");
    expect(result.runtimeStatePatch).toMatchObject({
      status: "success",
      accountId: 26,
      variant: "positions",
      payload: {
        rows: [],
        weights_date: "2026-05-18T09:30:00Z",
      },
    });
  });

  it("still reports canExecute for account hydration when account id exists and no local rows exist", () => {
    expect(
      portfolioWeightsExecutionDefinition.canExecute({
        props: {
          sourceType: "account",
          accountId: 26,
          editableInPlace: true,
          positionRows: [],
        },
      } as never),
    ).toBe(true);
  });
});
