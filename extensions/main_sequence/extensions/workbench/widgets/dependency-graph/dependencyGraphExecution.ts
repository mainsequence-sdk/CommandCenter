import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  fetchLocalTimeSerieDependencyGraph,
  listLocalTimeSeries,
} from "../../../../common/api";
import {
  normalizeDependencyGraphDirection,
  normalizeDependencyGraphRuntimeState,
  normalizeDependencyGraphSelectedId,
  type MainSequenceDependencyGraphWidgetProps,
  type MainSequenceDependencyGraphWidgetRuntimeState,
} from "./dependencyGraphRuntime";

function buildDependencyGraphRuntimeState(
  currentRuntimeState: Record<string, unknown> | undefined,
  patch: Partial<MainSequenceDependencyGraphWidgetRuntimeState>,
): MainSequenceDependencyGraphWidgetRuntimeState {
  const current = normalizeDependencyGraphRuntimeState(currentRuntimeState);

  return {
    ...current,
    ...patch,
  };
}

function buildDependencyGraphExecutionErrorResult(
  context: WidgetExecutionContext<MainSequenceDependencyGraphWidgetProps>,
  patch: Partial<MainSequenceDependencyGraphWidgetRuntimeState>,
  error: string,
): WidgetExecutionResult {
  return {
    status: "error",
    error,
    runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
      ...patch,
      status: "error",
      error,
      payload: undefined,
    }),
  };
}

export async function executeDependencyGraphWidget(
  context: WidgetExecutionContext<MainSequenceDependencyGraphWidgetProps>,
): Promise<WidgetExecutionResult> {
  const requestTraceMeta = buildDashboardExecutionRequestTraceMeta(context);
  const props = (context.targetOverrides?.props ?? context.props) as MainSequenceDependencyGraphWidgetProps;
  const direction = normalizeDependencyGraphDirection(props.direction);
  const selectedDataNodeUid = normalizeDependencyGraphSelectedId(props.dataNodeUid);

  if (!selectedDataNodeUid) {
    return {
      status: "skipped",
      runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        direction,
        selectedDataNodeUid: undefined,
        resolvedLocalTimeSerieId: undefined,
        payload: undefined,
        emptyReason: undefined,
      }),
    };
  }

  let resolvedLocalTimeSerieId: string | undefined;

  try {
    const page = await listLocalTimeSeries(selectedDataNodeUid, {
      limit: 1,
      offset: 0,
      traceMeta: requestTraceMeta,
    });
    const latestUpdate = page.results[0] ?? null;
    resolvedLocalTimeSerieId = normalizeDependencyGraphSelectedId(latestUpdate?.uid);
  } catch (error) {
    return buildDependencyGraphExecutionErrorResult(
      context,
      {
        direction,
        selectedDataNodeUid,
        resolvedLocalTimeSerieId: undefined,
        emptyReason: undefined,
      },
      error instanceof Error
        ? error.message
        : "Unable to resolve the latest LocalTimeSerie update for this Data Node.",
    );
  }

  if (!resolvedLocalTimeSerieId) {
    return {
      status: "success",
      runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
        status: "success",
        error: undefined,
        direction,
        selectedDataNodeUid,
        resolvedLocalTimeSerieId: undefined,
        payload: undefined,
        emptyReason: "no-linked-updates",
        lastLoadedAtMs: Date.now(),
      }),
    };
  }

  try {
    const payload = await fetchLocalTimeSerieDependencyGraph(
      resolvedLocalTimeSerieId,
      direction,
      requestTraceMeta,
    );

    return {
      status: "success",
      runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
        status: "success",
        error: undefined,
        direction,
        selectedDataNodeUid,
        resolvedLocalTimeSerieId,
        payload,
        emptyReason: undefined,
        lastLoadedAtMs: Date.now(),
      }),
    };
  } catch (error) {
    return buildDependencyGraphExecutionErrorResult(
      context,
      {
        direction,
        selectedDataNodeUid,
        resolvedLocalTimeSerieId,
        emptyReason: undefined,
      },
      error instanceof Error
        ? error.message
        : "Unable to load the dependency graph payload.",
    );
  }
}

export const dependencyGraphExecutionDefinition = {
  canExecute: (context) => {
    const props = (context.targetOverrides?.props ?? context.props) as MainSequenceDependencyGraphWidgetProps;
    return Boolean(normalizeDependencyGraphSelectedId(props.dataNodeUid));
  },
  execute: executeDependencyGraphWidget,
  getRefreshPolicy: () => "allow-refresh",
  getExecutionKey: (context) => `main-sequence-dependency-graph:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<MainSequenceDependencyGraphWidgetProps>;
