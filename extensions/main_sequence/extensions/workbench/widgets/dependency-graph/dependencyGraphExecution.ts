import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";

import {
  fetchDataNodeDetail,
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
  const selectedDataNodeUid = normalizeDependencyGraphSelectedId(props.dataNodeUid);
  const selectedSimpleTableUpdateUid = normalizeDependencyGraphSelectedId(props.simpleTableUpdateUid);

  if (sourceKind === "data_node" && !selectedDataNodeUid) {
    return {
      status: "skipped",
      runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        sourceKind,
        direction,
        selectedDataNodeUid: undefined,
        selectedSimpleTableUpdateUid: undefined,
        resolvedLocalTimeSerieId: undefined,
        payload: undefined,
        emptyReason: undefined,
      }),
    };
  }

  if (sourceKind === "simple_table" && !selectedSimpleTableUpdateUid) {
    return {
      status: "skipped",
      runtimeStatePatch: buildDependencyGraphRuntimeState(context.runtimeState, {
        status: "idle",
        error: undefined,
        sourceKind,
        direction,
        selectedDataNodeUid: undefined,
        selectedSimpleTableUpdateUid: undefined,
        resolvedLocalTimeSerieId: undefined,
        payload: undefined,
        emptyReason: undefined,
      }),
    };
  }

  let resolvedLocalTimeSerieId: string | undefined;

  if (sourceKind === "data_node") {
    try {
      const dataNodeDetail = await fetchDataNodeDetail(selectedDataNodeUid, requestTraceMeta);
      const page = await listLocalTimeSeries(dataNodeDetail.id, {
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
          sourceKind,
          direction,
          selectedDataNodeUid,
          selectedSimpleTableUpdateUid: undefined,
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
          selectedDataNodeUid,
          selectedSimpleTableUpdateUid: undefined,
          resolvedLocalTimeSerieId: undefined,
          payload: undefined,
          emptyReason: "no-linked-updates",
          lastLoadedAtMs: Date.now(),
        }),
      };
    }
  }

  const selectedSourceId =
    sourceKind === "simple_table" ? selectedSimpleTableUpdateUid : resolvedLocalTimeSerieId;

  try {
    const payload =
      sourceKind === "simple_table"
        ? await fetchSimpleTableUpdateDependencyGraph(
            selectedSimpleTableUpdateUid!,
            direction,
            requestTraceMeta,
          )
        : await fetchLocalTimeSerieDependencyGraph(
            resolvedLocalTimeSerieId!,
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
        selectedDataNodeUid: sourceKind === "data_node" ? selectedDataNodeUid : undefined,
        selectedSimpleTableUpdateUid:
          sourceKind === "simple_table" ? selectedSimpleTableUpdateUid : undefined,
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
        selectedDataNodeUid: sourceKind === "data_node" ? selectedDataNodeUid : undefined,
        selectedSimpleTableUpdateUid:
          sourceKind === "simple_table" ? selectedSimpleTableUpdateUid : undefined,
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
      ? Boolean(normalizeDependencyGraphSelectedId(props.simpleTableUpdateUid))
      : Boolean(normalizeDependencyGraphSelectedId(props.dataNodeUid));
  },
  execute: executeDependencyGraphWidget,
  getRefreshPolicy: () => "allow-refresh",
  getExecutionKey: (context) => `main-sequence-dependency-graph:${context.instanceId}`,
} satisfies WidgetExecutionDefinition<MainSequenceDependencyGraphWidgetProps>;
