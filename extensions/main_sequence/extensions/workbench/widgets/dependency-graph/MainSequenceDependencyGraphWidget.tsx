import { useQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  fetchLocalTimeSerieDependencyGraph,
  fetchSimpleTableUpdateDependencyGraph,
  formatMainSequenceError,
  listLocalTimeSeries,
} from "../../../../common/api";
import { MainSequenceUpdateDependencyGraph } from "./MainSequenceUpdateDependencyGraph";

export interface MainSequenceDependencyGraphWidgetProps extends Record<string, unknown> {
  dataNodeId?: number;
  direction?: "downstream" | "upstream";
  sourceKind?: "data_node" | "simple_table";
  simpleTableUpdateId?: number;
}

function normalizeSourceKind(
  value: unknown,
): "data_node" | "simple_table" {
  return value === "simple_table" ? "simple_table" : "data_node";
}

function normalizeSelectedSourceId(value: unknown) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.trunc(parsed);
}

export function MainSequenceDependencyGraphWidget({
  props,
  runtimeState,
  onRuntimeStateChange,
}: WidgetComponentProps<MainSequenceDependencyGraphWidgetProps>) {
  const { t } = useTranslation();
  const direction = props.direction === "upstream" ? "upstream" : "downstream";
  const sourceKind = normalizeSourceKind(props.sourceKind);
  const selectedDataNodeId = normalizeSelectedSourceId(props.dataNodeId);
  const selectedSimpleTableUpdateId = normalizeSelectedSourceId(props.simpleTableUpdateId);
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

  const latestLocalTimeSerieQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "dependency_graph_widget",
      "data_node",
      selectedDataNodeId,
      "latest_local_time_serie",
    ],
    queryFn: async () => {
      const page = await listLocalTimeSeries(selectedDataNodeId, { limit: 1, offset: 0 });
      return page.results[0] ?? null;
    },
    enabled: sourceKind === "data_node" && selectedDataNodeId > 0,
    staleTime: 300_000,
  });

  const resolvedLocalTimeSerieId =
    sourceKind === "data_node"
      ? normalizeSelectedSourceId(latestLocalTimeSerieQuery.data?.id)
      : 0;
  const selectedSourceId =
    sourceKind === "simple_table" ? selectedSimpleTableUpdateId : resolvedLocalTimeSerieId;

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

  if (sourceKind === "data_node" && latestLocalTimeSerieQuery.isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="text-sm font-medium text-foreground">Resolving Data Node update</div>
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

  if (sourceKind === "data_node" && latestLocalTimeSerieQuery.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-6 text-center">
        <div className="text-sm font-medium text-foreground">Unable to resolve Data Node update</div>
        <p className="text-sm text-danger">
          {formatMainSequenceError(latestLocalTimeSerieQuery.error)}
        </p>
      </div>
    );
  }

  if (sourceKind === "data_node" && selectedSourceId <= 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="text-sm font-medium text-foreground">No Data Node updates found</div>
        <p className="text-sm text-muted-foreground">
          The selected Data Node does not currently have any linked LocalTimeSerie updates.
        </p>
      </div>
    );
  }

  return (
    <MainSequenceUpdateDependencyGraph
      direction={direction}
      enabled={selectedSourceId > 0}
      queryKey={
        sourceKind === "simple_table"
          ? ["main_sequence", "simple_tables", "updates", "graph", selectedSourceId]
          : ["main_sequence", "data_nodes", "local_updates", "graph", selectedSourceId]
      }
      queryFn={() =>
        sourceKind === "simple_table"
          ? fetchSimpleTableUpdateDependencyGraph(selectedSourceId, direction)
          : fetchLocalTimeSerieDependencyGraph(selectedSourceId, direction)
      }
      runtimeState={runtimeState}
      onRuntimeStateChange={onRuntimeStateChange}
      variant="widget"
    />
  );
}
