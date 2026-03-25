import { useQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  formatMainSequenceError,
  type LocalTimeSerieDependencyGraphResponse,
} from "../../../../common/api";
import {
  MainSequenceDependencyGraphExplorer,
  type MainSequenceDependencyGraphRuntimeState,
} from "./MainSequenceDependencyGraphExplorer";
import type { MainSequenceDependencyGraphDirection } from "./graphLayout";

function directionLabel(
  direction: MainSequenceDependencyGraphDirection,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return direction === "downstream"
    ? t("mainSequenceDependencyGraph.directionDownstream")
    : t("mainSequenceDependencyGraph.directionUpstream");
}

export function MainSequenceUpdateDependencyGraph({
  direction,
  enabled = true,
  queryKey,
  queryFn,
  runtimeState,
  onRuntimeStateChange,
  variant = "card",
}: {
  direction: MainSequenceDependencyGraphDirection;
  enabled?: boolean;
  queryKey: readonly unknown[];
  queryFn: () => Promise<LocalTimeSerieDependencyGraphResponse>;
  runtimeState?: MainSequenceDependencyGraphRuntimeState;
  onRuntimeStateChange?: (state: Record<string, unknown> | undefined) => void;
  variant?: "card" | "widget";
}) {
  const { t } = useTranslation();
  const graphQuery = useQuery({
    queryKey: [...queryKey, direction],
    queryFn,
    enabled,
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
              <span>{directionLabel(direction, t)}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {t("mainSequenceDependencyGraph.widget.summaryDescription")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              {direction === "upstream"
                ? t("mainSequenceDependencyGraph.settings.directionUpstreamShort")
                : t("mainSequenceDependencyGraph.settings.directionDownstreamShort")}
            </Badge>
            <Badge variant="neutral">
              {t("mainSequenceDependencyGraph.widget.nodesCount", {
                count: payload?.nodes.length ?? 0,
              })}
            </Badge>
            <Badge variant="neutral">
              {t("mainSequenceDependencyGraph.widget.edgesCount", {
                count: payload?.edges.length ?? 0,
              })}
            </Badge>
          </div>
        </div>

        <MainSequenceDependencyGraphExplorer
          direction={direction}
          payload={payload}
          isLoading={graphQuery.isLoading}
          error={error}
          runtimeState={runtimeState}
          onRuntimeStateChange={onRuntimeStateChange}
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
              {directionLabel(direction, t)}
            </CardTitle>
            <CardDescription>
              {t("mainSequenceDependencyGraph.widget.legacyDescription")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              {t("mainSequenceDependencyGraph.widget.nodesCount", {
                count: payload?.nodes.length ?? 0,
              })}
            </Badge>
            <Badge variant="neutral">
              {t("mainSequenceDependencyGraph.widget.edgesCount", {
                count: payload?.edges.length ?? 0,
              })}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <MainSequenceDependencyGraphExplorer
          direction={direction}
          payload={payload}
          isLoading={graphQuery.isLoading}
          error={error}
          runtimeState={runtimeState}
          onRuntimeStateChange={onRuntimeStateChange}
          variant="card"
        />
      </CardContent>
    </Card>
  );
}
