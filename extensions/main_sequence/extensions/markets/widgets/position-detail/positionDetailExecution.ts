import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  fetchManagedAccountHoldingsPositionDetails,
  fetchTargetPositionDetailPositionDetails,
} from "../../../../common/api";
import {
  normalizePositionDetailAccountUid,
  normalizePositionDetailPersistedRows,
  normalizePositionDetailRuntimeState,
  normalizePositionDetailSourceType,
  normalizePositionDetailTargetId,
  normalizePositionDetailVariant,
  type PositionDetailWidgetProps,
  type PositionDetailWidgetRuntimeState,
} from "./positionDetailRuntime";

function buildPositionDetailRuntimeState(
  currentRuntimeState: Record<string, unknown> | undefined,
  patch: Partial<PositionDetailWidgetRuntimeState>,
): PositionDetailWidgetRuntimeState {
  const current = normalizePositionDetailRuntimeState(currentRuntimeState);
  return {
    ...current,
    ...patch,
  };
}

export async function executePositionDetailWidget(
  context: WidgetExecutionContext<PositionDetailWidgetProps>,
): Promise<WidgetExecutionResult> {
  const props = (context.targetOverrides?.props ?? context.props) as PositionDetailWidgetProps;
  const sourceType = normalizePositionDetailSourceType(props);
  const targetPortfolioId = normalizePositionDetailTargetId(props);
  const accountUid = normalizePositionDetailAccountUid(props);
  const variant = normalizePositionDetailVariant(props.variant);
  const persistedRows = normalizePositionDetailPersistedRows(props);

  if (sourceType === "target_position" || persistedRows.length > 0) {
    return {
      status: "skipped",
      runtimeStatePatch: buildPositionDetailRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        targetPortfolioId: undefined,
        accountUid: undefined,
        variant: "positions",
        payload: undefined,
      }),
    };
  }

  if (sourceType === "portfolio" && targetPortfolioId <= 0) {
    return {
      status: "skipped",
      runtimeStatePatch: buildPositionDetailRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        targetPortfolioId: undefined,
        accountUid: undefined,
        variant,
        payload: undefined,
      }),
    };
  }

  if (sourceType === "account" && !accountUid) {
    return {
      status: "skipped",
      runtimeStatePatch: buildPositionDetailRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        targetPortfolioId: undefined,
        accountUid: undefined,
        variant,
        payload: undefined,
      }),
    };
  }

  try {
    const requestTraceMeta = buildDashboardExecutionRequestTraceMeta(context);
    const payload =
      sourceType === "account"
        ? await fetchManagedAccountHoldingsPositionDetails(accountUid, {
            traceMeta: requestTraceMeta,
          })
        : await fetchTargetPositionDetailPositionDetails(
            targetPortfolioId,
            requestTraceMeta,
          );

    return {
      status: "success",
      runtimeStatePatch: buildPositionDetailRuntimeState(context.runtimeState, {
        status: "success",
        error: undefined,
        targetPortfolioId: sourceType === "portfolio" ? targetPortfolioId : undefined,
        accountUid: sourceType === "account" ? accountUid : undefined,
        variant,
        payload,
        lastLoadedAtMs: Date.now(),
      }),
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unable to load position details.",
      runtimeStatePatch: buildPositionDetailRuntimeState(context.runtimeState, {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : sourceType === "account"
              ? "Unable to load account holdings."
              : "Unable to load position details.",
        targetPortfolioId: sourceType === "portfolio" ? targetPortfolioId : undefined,
        accountUid: sourceType === "account" ? accountUid : undefined,
        variant,
        payload: undefined,
      }),
    };
  }
}

export const positionDetailExecutionDefinition = {
  canExecute: (context) =>
    (() => {
      const props = (context.targetOverrides?.props ?? context.props) as PositionDetailWidgetProps;
      const sourceType = normalizePositionDetailSourceType(props);
      if (normalizePositionDetailPersistedRows(props).length > 0) {
        return false;
      }
      if (sourceType === "portfolio") {
        return normalizePositionDetailTargetId(props) > 0;
      }
      if (sourceType === "account") {
        return Boolean(normalizePositionDetailAccountUid(props));
      }
      return false;
    })(),
  execute: executePositionDetailWidget,
  getRefreshPolicy: () => "allow-refresh",
  getExecutionKey: (context) => `position-detail:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<PositionDetailWidgetProps>;
