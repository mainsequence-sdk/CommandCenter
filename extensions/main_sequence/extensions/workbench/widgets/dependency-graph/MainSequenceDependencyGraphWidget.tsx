import { Network } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { useWidgetExecutionState } from "@/dashboards/DashboardWidgetExecution";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  formatMainSequenceError,
} from "../../../../common/api";
import { MainSequenceUpdateDependencyGraph } from "./MainSequenceUpdateDependencyGraph";
import {
  normalizeDependencyGraphDirection,
  normalizeDependencyGraphRuntimeState,
  normalizeDependencyGraphSelectedId,
  normalizeDependencyGraphSourceKind,
  type MainSequenceDependencyGraphWidgetProps,
} from "./dependencyGraphRuntime";

export function MainSequenceDependencyGraphWidget({
  instanceId,
  props,
  runtimeState,
  onRuntimeStateChange,
}: WidgetComponentProps<MainSequenceDependencyGraphWidgetProps>) {
  const { t } = useTranslation();
  const executionState = useWidgetExecutionState(instanceId);
  const direction = normalizeDependencyGraphDirection(props.direction);
  const sourceKind = normalizeDependencyGraphSourceKind(props.sourceKind);
  const selectedDataNodeId = normalizeDependencyGraphSelectedId(props.dataNodeId);
  const selectedSimpleTableUpdateId = normalizeDependencyGraphSelectedId(props.simpleTableUpdateId);
  const normalizedRuntimeState = normalizeDependencyGraphRuntimeState(runtimeState);
  const directionLabel =
    direction === "upstream"
      ? t("mainSequenceDependencyGraph.settings.directionUpstreamShort")
      : t("mainSequenceDependencyGraph.settings.directionDownstreamShort");
  const sourceBadge = sourceKind === "simple_table" ? "Simple Tables" : "Data Nodes";
  const missingTitle =
    sourceKind === "simple_table"
      ? "Dependency graph needs a Simple Table update"
      : "Dependency graph needs a Data Node";
  const missingDescription =
    sourceKind === "simple_table"
      ? "Select a Simple Table update in widget settings to load upstream or downstream dependencies."
      : "Select a Data Node in widget settings. The graph uses the latest linked LocalTimeSerie update for that data node.";
  const isExecuting = executionState?.status === "running";
  const selectedSourceId =
    sourceKind === "simple_table"
      ? selectedSimpleTableUpdateId
      : (normalizedRuntimeState.resolvedLocalTimeSerieId ?? 0);

  if (
    (sourceKind === "data_node" && selectedDataNodeId <= 0) ||
    (sourceKind === "simple_table" && selectedSimpleTableUpdateId <= 0)
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Network className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{missingTitle}</div>
          <p className="text-sm text-muted-foreground">{missingDescription}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="neutral">{sourceBadge}</Badge>
          <Badge variant="neutral">{directionLabel}</Badge>
        </div>
      </div>
    );
  }

  if (sourceKind === "data_node" && normalizedRuntimeState.emptyReason === "no-linked-updates") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="text-sm font-medium text-foreground">No Data Node updates found</div>
        <p className="text-sm text-muted-foreground">
          The selected Data Node does not currently have any linked LocalTimeSerie updates.
        </p>
      </div>
    );
  }

  if (normalizedRuntimeState.status === "error" && normalizedRuntimeState.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-6 text-center">
        <div className="text-sm font-medium text-foreground">Unable to load dependency graph</div>
        <p className="text-sm text-danger">
          {formatMainSequenceError(normalizedRuntimeState.error)}
        </p>
      </div>
    );
  }

  if (
    isExecuting ||
    normalizedRuntimeState.status === "loading" ||
    (!normalizedRuntimeState.payload && selectedSourceId > 0)
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="text-sm font-medium text-foreground">
          {sourceKind === "data_node" ? "Resolving Data Node update" : "Loading dependency graph"}
        </div>
        <p className="text-sm text-muted-foreground">
          {sourceKind === "data_node"
            ? "Loading the latest LocalTimeSerie update linked to the selected Data Node."
            : "Loading the dependency graph for the selected Simple Table update."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="neutral">{sourceBadge}</Badge>
          <Badge variant="neutral">{directionLabel}</Badge>
        </div>
      </div>
    );
  }

  return (
    <MainSequenceUpdateDependencyGraph
      direction={direction}
      enabled={selectedSourceId > 0}
      error={normalizedRuntimeState.error ?? null}
      isLoading={isExecuting}
      payload={normalizedRuntimeState.payload}
      runtimeState={normalizedRuntimeState}
      onRuntimeStateChange={(nextState) =>
        onRuntimeStateChange?.({
          ...normalizedRuntimeState,
          ...nextState,
          payload: normalizedRuntimeState.payload,
          error: normalizedRuntimeState.error,
          status: normalizedRuntimeState.status,
          sourceKind: normalizedRuntimeState.sourceKind,
          direction: normalizedRuntimeState.direction,
          selectedDataNodeId: normalizedRuntimeState.selectedDataNodeId,
          selectedSimpleTableUpdateId: normalizedRuntimeState.selectedSimpleTableUpdateId,
          resolvedLocalTimeSerieId: normalizedRuntimeState.resolvedLocalTimeSerieId,
          emptyReason: normalizedRuntimeState.emptyReason,
          lastLoadedAtMs: normalizedRuntimeState.lastLoadedAtMs,
        })
      }
      variant="widget"
    />
  );
}
