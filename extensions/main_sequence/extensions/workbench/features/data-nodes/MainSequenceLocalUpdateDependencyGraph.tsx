import { useQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  fetchLocalTimeSerieDependencyGraph,
  formatMainSequenceError,
} from "../../../../common/api";
import {
  MainSequenceDependencyGraphExplorer,
} from "../../widgets/dependency-graph/MainSequenceDependencyGraphExplorer";
import type {
  MainSequenceDependencyGraphDirection,
} from "../../widgets/dependency-graph/graphLayout";

function directionLabel(direction: MainSequenceDependencyGraphDirection) {
  return direction === "downstream" ? "Downstream graph" : "Upstream graph";
}

export function MainSequenceLocalUpdateDependencyGraph({
  direction,
  enabled = true,
  localTimeSerieId,
  variant = "card",
}: {
  direction: MainSequenceDependencyGraphDirection;
  enabled?: boolean;
  localTimeSerieId: number;
  variant?: "card" | "widget";
}) {
  const graphQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "local_updates", "graph", localTimeSerieId, direction],
    queryFn: () => fetchLocalTimeSerieDependencyGraph(localTimeSerieId, direction),
    enabled: enabled && localTimeSerieId > 0,
  });
  const payload = graphQuery.data;
  const error = graphQuery.isError ? formatMainSequenceError(graphQuery.error) : null;

  if (variant === "widget") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Network className="h-4 w-4 text-primary" />
              <span>{directionLabel(direction)}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Interactive dependency explorer for LocalTimeSerie graph data.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{direction}</Badge>
            <Badge variant="neutral">{`${payload?.nodes.length ?? 0} nodes`}</Badge>
            <Badge variant="neutral">{`${payload?.edges.length ?? 0} edges`}</Badge>
          </div>
        </div>

        <MainSequenceDependencyGraphExplorer
          direction={direction}
          payload={payload}
          isLoading={graphQuery.isLoading}
          error={error}
          variant="widget"
        />
      </div>
    );
  }

  return (
    <Card variant="nested">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4 text-primary" />
              {directionLabel(direction)}
            </CardTitle>
            <CardDescription>
              Interactive dependency explorer aligned with the legacy graph flow.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{`${payload?.nodes.length ?? 0} nodes`}</Badge>
            <Badge variant="neutral">{`${payload?.edges.length ?? 0} edges`}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <MainSequenceDependencyGraphExplorer
          direction={direction}
          payload={payload}
          isLoading={graphQuery.isLoading}
          error={error}
          variant="card"
        />
      </CardContent>
    </Card>
  );
}
