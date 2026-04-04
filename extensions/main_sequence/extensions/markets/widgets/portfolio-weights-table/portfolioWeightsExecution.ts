import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  fetchTargetPortfolioWeightsPositionDetails,
} from "../../../../common/api";
import {
  normalizePortfolioWeightsRuntimeState,
  normalizePortfolioWeightsTargetId,
  normalizePortfolioWeightsVariant,
  type PortfolioWeightsWidgetProps,
  type PortfolioWeightsWidgetRuntimeState,
} from "./portfolioWeightsRuntime";

function buildPortfolioWeightsRuntimeState(
  currentRuntimeState: Record<string, unknown> | undefined,
  patch: Partial<PortfolioWeightsWidgetRuntimeState>,
): PortfolioWeightsWidgetRuntimeState {
  const current = normalizePortfolioWeightsRuntimeState(currentRuntimeState);
  return {
    ...current,
    ...patch,
  };
}

export async function executePortfolioWeightsWidget(
  context: WidgetExecutionContext<PortfolioWeightsWidgetProps>,
): Promise<WidgetExecutionResult> {
  const requestTraceMeta = buildDashboardExecutionRequestTraceMeta(context);
  const props = (context.targetOverrides?.props ?? context.props) as PortfolioWeightsWidgetProps;
  const targetPortfolioId = normalizePortfolioWeightsTargetId(props);
  const variant = normalizePortfolioWeightsVariant(props.variant);

  if (targetPortfolioId <= 0) {
    return {
      status: "skipped",
      runtimeStatePatch: buildPortfolioWeightsRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        targetPortfolioId: undefined,
        variant,
        payload: undefined,
      }),
    };
  }

  try {
    const payload = await fetchTargetPortfolioWeightsPositionDetails(
      targetPortfolioId,
      requestTraceMeta,
    );

    return {
      status: "success",
      runtimeStatePatch: buildPortfolioWeightsRuntimeState(context.runtimeState, {
        status: "success",
        error: undefined,
        targetPortfolioId,
        variant,
        payload,
        lastLoadedAtMs: Date.now(),
      }),
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unable to load portfolio weights.",
      runtimeStatePatch: buildPortfolioWeightsRuntimeState(context.runtimeState, {
        status: "error",
        error: error instanceof Error ? error.message : "Unable to load portfolio weights.",
        targetPortfolioId,
        variant,
        payload: undefined,
      }),
    };
  }
}

export const portfolioWeightsExecutionDefinition = {
  canExecute: (context) =>
    normalizePortfolioWeightsTargetId(
      (context.targetOverrides?.props ?? context.props) as PortfolioWeightsWidgetProps,
    ) > 0,
  execute: executePortfolioWeightsWidget,
  getRefreshPolicy: () => "allow-refresh",
  getExecutionKey: (context) => `portfolio-weights-table:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<PortfolioWeightsWidgetProps>;
