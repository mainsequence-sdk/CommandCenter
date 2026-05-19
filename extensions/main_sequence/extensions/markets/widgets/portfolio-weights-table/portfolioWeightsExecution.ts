import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  fetchManagedAccountHoldingsPositionDetails,
  fetchTargetPortfolioWeightsPositionDetails,
} from "../../../../common/api";
import {
  normalizePortfolioWeightsAccountId,
  normalizePortfolioWeightsPersistedRows,
  normalizePortfolioWeightsRuntimeState,
  normalizePortfolioWeightsSourceType,
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
  const props = (context.targetOverrides?.props ?? context.props) as PortfolioWeightsWidgetProps;
  const sourceType = normalizePortfolioWeightsSourceType(props);
  const targetPortfolioId = normalizePortfolioWeightsTargetId(props);
  const accountId = normalizePortfolioWeightsAccountId(props);
  const variant = normalizePortfolioWeightsVariant(props.variant);
  const persistedRows = normalizePortfolioWeightsPersistedRows(props);

  if (sourceType === "target_position" || persistedRows.length > 0) {
    return {
      status: "skipped",
      runtimeStatePatch: buildPortfolioWeightsRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        targetPortfolioId: undefined,
        accountId: undefined,
        variant: "positions",
        payload: undefined,
      }),
    };
  }

  if (sourceType === "portfolio" && targetPortfolioId <= 0) {
    return {
      status: "skipped",
      runtimeStatePatch: buildPortfolioWeightsRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        targetPortfolioId: undefined,
        accountId: undefined,
        variant,
        payload: undefined,
      }),
    };
  }

  if (sourceType === "account" && accountId <= 0) {
    return {
      status: "skipped",
      runtimeStatePatch: buildPortfolioWeightsRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        targetPortfolioId: undefined,
        accountId: undefined,
        variant,
        payload: undefined,
      }),
    };
  }

  try {
    const requestTraceMeta = buildDashboardExecutionRequestTraceMeta(context);
    const payload =
      sourceType === "account"
        ? await fetchManagedAccountHoldingsPositionDetails(accountId, {
            traceMeta: requestTraceMeta,
          })
        : await fetchTargetPortfolioWeightsPositionDetails(
            targetPortfolioId,
            requestTraceMeta,
          );

    return {
      status: "success",
      runtimeStatePatch: buildPortfolioWeightsRuntimeState(context.runtimeState, {
        status: "success",
        error: undefined,
        targetPortfolioId: sourceType === "portfolio" ? targetPortfolioId : undefined,
        accountId: sourceType === "account" ? accountId : undefined,
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
        error:
          error instanceof Error
            ? error.message
            : sourceType === "account"
              ? "Unable to load account holdings."
              : "Unable to load portfolio weights.",
        targetPortfolioId: sourceType === "portfolio" ? targetPortfolioId : undefined,
        accountId: sourceType === "account" ? accountId : undefined,
        variant,
        payload: undefined,
      }),
    };
  }
}

export const portfolioWeightsExecutionDefinition = {
  canExecute: (context) =>
    (() => {
      const props = (context.targetOverrides?.props ?? context.props) as PortfolioWeightsWidgetProps;
      const sourceType = normalizePortfolioWeightsSourceType(props);
      if (normalizePortfolioWeightsPersistedRows(props).length > 0) {
        return false;
      }
      if (sourceType === "portfolio") {
        return normalizePortfolioWeightsTargetId(props) > 0;
      }
      if (sourceType === "account") {
        return normalizePortfolioWeightsAccountId(props) > 0;
      }
      return false;
    })(),
  execute: executePortfolioWeightsWidget,
  getRefreshPolicy: () => "allow-refresh",
  getExecutionKey: (context) => `portfolio-weights-table:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<PortfolioWeightsWidgetProps>;
