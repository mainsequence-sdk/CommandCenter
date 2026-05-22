import { describe, expect, it, vi } from "vitest";

import {
  executePositionDetailWidget,
  positionDetailExecutionDefinition,
} from "./positionDetailExecution";

const {
  fetchManagedAccountHoldingsPositionDetails,
  fetchManagedAccountTargetPositionsPositionDetails,
  fetchTargetPositionDetailPositionDetails,
} = vi.hoisted(() => ({
  fetchManagedAccountHoldingsPositionDetails: vi.fn(),
  fetchManagedAccountTargetPositionsPositionDetails: vi.fn(),
  fetchTargetPositionDetailPositionDetails: vi.fn(),
}));

vi.mock("../../../../common/api", () => ({
  fetchManagedAccountHoldingsPositionDetails,
  fetchManagedAccountTargetPositionsPositionDetails,
  fetchTargetPositionDetailPositionDetails,
}));

describe("positionDetailExecution", () => {
  it("does not execute backend loading for target position sources", async () => {
    const result = await executePositionDetailWidget({
      props: {
        sourceType: "target_position",
        editableInPlace: true,
        positionRows: [],
      },
      runtimeState: undefined,
      instanceId: "position-detail-account",
      widgetId: "position-detail",
    } as never);

    expect(fetchTargetPositionDetailPositionDetails).not.toHaveBeenCalled();
    expect(fetchManagedAccountHoldingsPositionDetails).not.toHaveBeenCalled();
    expect(result.status).toBe("skipped");
    expect(result.runtimeStatePatch).toMatchObject({
      status: "idle",
      variant: "positions",
      payload: undefined,
    });
  });

  it("executes hydrated target positions account mode when account uid exists and no local rows exist", async () => {
    fetchManagedAccountTargetPositionsPositionDetails.mockResolvedValueOnce({
      weights: null,
      position_columns: [],
      rows: [],
      columnDefs: [],
      summaryColumnDefs: [],
      position_map: null,
      weights_date: "2026-05-19T10:30:00Z",
    });

    const result = await executePositionDetailWidget({
      props: {
        sourceType: "target_positions_account",
        accountUid: "managed-account-26",
        targetPositionsDate: "2026-05-19T10:30:00Z",
        editableInPlace: true,
        positionRows: [],
      },
      runtimeState: undefined,
      instanceId: "position-detail-account-target-positions",
      widgetId: "position-detail",
    } as never);

    expect(fetchTargetPositionDetailPositionDetails).not.toHaveBeenCalled();
    expect(fetchManagedAccountHoldingsPositionDetails).not.toHaveBeenCalled();
    expect(fetchManagedAccountTargetPositionsPositionDetails).toHaveBeenCalledWith(
      "managed-account-26",
      {
        targetPositionsDate: "2026-05-19T10:30:00.000Z",
        traceMeta: undefined,
      },
    );
    expect(result.status).toBe("success");
    expect(result.runtimeStatePatch).toMatchObject({
      status: "success",
      accountUid: "managed-account-26",
      variant: "positions",
      payload: {
        rows: [],
        weights_date: "2026-05-19T10:30:00Z",
      },
    });
  });

  it("does not execute backend loading once local rows exist", () => {
    expect(
      positionDetailExecutionDefinition.canExecute({
        props: {
          sourceType: "portfolio",
          portfolioUid: "target-portfolio-123",
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
      positionDetailExecutionDefinition.canExecute({
        props: {
          sourceType: "portfolio",
          portfolioUid: "target-portfolio-123",
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

    const result = await executePositionDetailWidget({
      props: {
        sourceType: "account",
        accountUid: "managed-account-26",
        editableInPlace: true,
        positionRows: [],
      },
      runtimeState: undefined,
      instanceId: "position-detail-account",
      widgetId: "position-detail",
    } as never);

    expect(fetchManagedAccountHoldingsPositionDetails).toHaveBeenCalledWith("managed-account-26", {
      traceMeta: undefined,
    });
    expect(result.status).toBe("success");
    expect(result.runtimeStatePatch).toMatchObject({
      status: "success",
      accountUid: "managed-account-26",
      variant: "positions",
      payload: {
        rows: [],
        weights_date: "2026-05-18T09:30:00Z",
      },
    });
  });

  it("still reports canExecute for account hydration when account uid exists and no local rows exist", () => {
    expect(
      positionDetailExecutionDefinition.canExecute({
        props: {
          sourceType: "account",
          accountUid: "managed-account-26",
          editableInPlace: true,
          positionRows: [],
        },
      } as never),
    ).toBe(true);
  });

  it("still reports canExecute for target positions account hydration when account uid exists and no local rows exist", () => {
    expect(
      positionDetailExecutionDefinition.canExecute({
        props: {
          sourceType: "target_positions_account",
          accountUid: "managed-account-26",
          editableInPlace: true,
          positionRows: [],
        },
      } as never),
    ).toBe(true);
  });

  it("uses the canonical position detail execution key prefix", () => {
    expect(
      positionDetailExecutionDefinition.getExecutionKey({
        instanceId: "position-detail-42",
      } as never),
    ).toBe("position-detail:position-detail-42");
  });
});
