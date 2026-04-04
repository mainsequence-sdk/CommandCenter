import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  fetchLocalTimeSerieDependencyGraph,
  fetchSimpleTableUpdateDependencyGraph,
  listLocalTimeSeries,
} from "../../../../common/api";
import {
  normalizeDependencyGraphDirection,
  normalizeDependencyGraphRuntimeState,
  normalizeDependencyGraphSelectedId,
  normalizeDependencyGraphSourceKind,
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
  const sourceKind = normalizeDependencyGraphSourceKind(props.sourceKind);
  const direction = normalizeDependencyGraphDirection(props.direction);
  const selectedDataNodeId = normalizeDependencyGraphSelectedId(props.dataNodeId);
  const selectedSimpleTableUpdateId = normalizeDependencyGraphSelectedId(props.simpleTableUpdateId);

  if (sourceKind === "data_node" && selectedDataNodeId <= 0) {
    return {
      status: "skipped",
      runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        sourceKind,
        direction,
        selectedDataNodeId: undefined,
        selectedSimpleTableUpdateId: undefined,
        resolvedLocalTimeSerieId: undefined,
        payload: undefined,
        emptyReason: undefined,
      }),
    };
  }

  if (sourceKind === "simple_table" && selectedSimpleTableUpdateId <= 0) {
    return {
      status: "skipped",
      runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        sourceKind,
        direction,
        selectedDataNodeId: undefined,
        selectedSimpleTableUpdateId: undefined,
        resolvedLocalTimeSerieId: undefined,
        payload: undefined,
        emptyReason: undefined,
      }),
    };
  }

  let resolvedLocalTimeSerieId: number | undefined;

  if (sourceKind === "data_node") {
    try {
      const page = await listLocalTimeSeries(selectedDataNodeId, {
        limit: 1,
        offset: 0,
        traceMeta: requestTraceMeta,
      });
      const latestUpdate = page.results[0] ?? null;
      resolvedLocalTimeSerieId = normalizeDependencyGraphSelectedId(latestUpdate?.id);
    } catch (error) {
      return buildDependencyGraphExecutionErrorResult(
        context,
        {
          sourceKind,
          direction,
          selectedDataNodeId,
          selectedSimpleTableUpdateId: undefined,
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
          sourceKind,
          direction,
          selectedDataNodeId,
          selectedSimpleTableUpdateId: undefined,
          resolvedLocalTimeSerieId: undefined,
          payload: undefined,
          emptyReason: "no-linked-updates",
          lastLoadedAtMs: Date.now(),
        }),
      };
    }
  }

  const selectedSourceId =
    sourceKind === "simple_table" ? selectedSimpleTableUpdateId : resolvedLocalTimeSerieId ?? 0;

  try {
    const payload =
      sourceKind === "simple_table"
        ? await fetchSimpleTableUpdateDependencyGraph(
            selectedSourceId,
            direction,
            requestTraceMeta,
          )
        : await fetchLocalTimeSerieDependencyGraph(
            selectedSourceId,
            direction,
            requestTraceMeta,
          );

    return {
      status: "success",
      runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
        status: "success",
        error: undefined,
        sourceKind,
        direction,
        selectedDataNodeId: sourceKind === "data_node" ? selectedDataNodeId : undefined,
        selectedSimpleTableUpdateId:
          sourceKind === "simple_table" ? selectedSimpleTableUpdateId : undefined,
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
        sourceKind,
        direction,
        selectedDataNodeId: sourceKind === "data_node" ? selectedDataNodeId : undefined,
        selectedSimpleTableUpdateId:
          sourceKind === "simple_table" ? selectedSimpleTableUpdateId : undefined,
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
    const sourceKind = normalizeDependencyGraphSourceKind(props.sourceKind);
    return sourceKind === "simple_table"
      ? normalizeDependencyGraphSelectedId(props.simpleTableUpdateId) > 0
      : normalizeDependencyGraphSelectedId(props.dataNodeId) > 0;
  },
  execute: executeDependencyGraphWidget,
  getRefreshPolicy: () => "allow-refresh",
  getExecutionKey: (context) => `main-sequence-dependency-graph:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<MainSequenceDependencyGraphWidgetProps>;
