import { describe, expect, it, vi } from "vitest";

import {
  executePortfolioWeightsWidget,
  portfolioWeightsExecutionDefinition,
} from "./portfolioWeightsExecution";

const { fetchTargetPortfolioWeightsPositionDetails } = vi.hoisted(() => ({
  fetchTargetPortfolioWeightsPositionDetails: vi.fn(),
}));

vi.mock("../../../../common/api", () => ({
  fetchTargetPortfolioWeightsPositionDetails,
}));

describe("portfolioWeightsExecution", () => {
  it("does not execute backend loading in inline mode", async () => {
    const result = await executePortfolioWeightsWidget({
      props: {
        editableInPlace: true,
        dataMode: "inline",
        inlineRows: [],
      },
      runtimeState: undefined,
      instanceId: "portfolio-weights-inline",
      widgetId: "portfolio-weights-table",
    } as never);

    expect(fetchTargetPortfolioWeightsPositionDetails).not.toHaveBeenCalled();
    expect(result.status).toBe("skipped");
    expect(result.runtimeStatePatch).toMatchObject({
      status: "idle",
      variant: "positions",
      payload: undefined,
    });
  });

  it("reports canExecute false for inline mode", () => {
    expect(
      portfolioWeightsExecutionDefinition.canExecute({
        props: {
          editableInPlace: true,
          dataMode: "inline",
          inlineRows: [],
          portfolioId: 123,
        },
      } as never),
    ).toBe(false);
  });
});
