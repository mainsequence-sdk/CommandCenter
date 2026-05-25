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
  const selectedDataNodeUid = normalizeDependencyGraphSelectedId(props.dataNodeUid);
  const normalizedRuntimeState = normalizeDependencyGraphRuntimeState(runtimeState);
  const directionLabel =
    direction === "upstream"
      ? t("mainSequenceDependencyGraph.settings.directionUpstreamShort")
      : t("mainSequenceDependencyGraph.settings.directionDownstreamShort");
  const sourceBadge = "Data Nodes";
  const missingTitle = "Dependency graph needs a Data Node";
  const missingDescription =
    "Select a Data Node in widget settings. The graph uses the latest linked LocalTimeSerie update for that data node.";
  const isExecuting = executionState?.status === "running";
  const selectedSourceId = normalizedRuntimeState.resolvedLocalTimeSerieId;

  if (!selectedDataNodeUid) {
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

  if (normalizedRuntimeState.emptyReason === "no-linked-updates") {
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
    (!normalizedRuntimeState.payload && Boolean(selectedSourceId))
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="text-sm font-medium text-foreground">
          Resolving Data Node update
        </div>
        <p className="text-sm text-muted-foreground">
          Loading the latest LocalTimeSerie update linked to the selected Data Node.
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
      enabled={Boolean(selectedSourceId)}
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
          direction: normalizedRuntimeState.direction,
          selectedDataNodeUid: normalizedRuntimeState.selectedDataNodeUid,
          resolvedLocalTimeSerieId: normalizedRuntimeState.resolvedLocalTimeSerieId,
          emptyReason: normalizedRuntimeState.emptyReason,
          lastLoadedAtMs: normalizedRuntimeState.lastLoadedAtMs,
        })
      }
      variant="widget"
    />
  );
}
