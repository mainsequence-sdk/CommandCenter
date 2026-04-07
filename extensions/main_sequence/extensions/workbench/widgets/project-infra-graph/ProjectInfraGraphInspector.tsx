import { ArrowLeft, Loader2, Network } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { formatMainSequenceError, type SummaryResponse } from "../../../../common/api";
import type {
  ProjectInfraGraphRecordNode,
  ProjectInfraGraphScope,
} from "./projectInfraGraphTypes";

function readCommitSha(scope: ProjectInfraGraphScope) {
  if (scope.commitSha?.trim()) {
    return scope.commitSha.trim();
  }

  if (!scope.graphUrl) {
    return null;
  }

  try {
    const parsed = new URL(scope.graphUrl, "https://mainsequence.local");
    const commitSha = parsed.searchParams.get("commit_sha");

    return commitSha?.trim() || null;
  } catch {
    return null;
  }
}

export function ProjectInfraGraphInspector({
  canGoBack,
  compact = false,
  currentScope,
  onExploreGraph,
  onGoBack,
  selectedNode,
  summary,
  summaryError,
  summaryLoading,
}: {
  canGoBack: boolean;
  compact?: boolean;
  currentScope: ProjectInfraGraphScope;
  onExploreGraph: (node: ProjectInfraGraphRecordNode) => void;
  onGoBack: () => void;
  selectedNode: ProjectInfraGraphRecordNode | null;
  summary: SummaryResponse | undefined;
  summaryError: unknown;
  summaryLoading: boolean;
}) {
  const commitSha = readCommitSha(currentScope);
  const canExploreSelectedNode = Boolean(
    selectedNode?.graph_url &&
      selectedNode.graph_url !== currentScope.graphUrl &&
      !(currentScope.graphUrl === null && selectedNode.node_type === "project"),
  );

  return (
    <div className={compact ? "flex h-full min-h-[360px] flex-col gap-3" : "flex h-full min-h-[720px] flex-col gap-4"}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Graph scope
              </div>
              <CardTitle className="text-base">{currentScope.label}</CardTitle>
            </div>
            {canGoBack ? (
              <Button variant="outline" size="sm" onClick={onGoBack}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">Inspect to fetch summary</Badge>
            {commitSha ? (
              <Badge variant="neutral">{`Commit: ${commitSha.slice(0, 7)}`}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!selectedNode ? (
        <Card className="flex-1">
          <CardContent className="flex h-full min-h-[280px] items-center justify-center pt-6">
            <div className="max-w-sm text-center">
              <div className="text-sm font-medium text-foreground">Select a node</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Click a graph card to inspect its summary. If the backend exposes `graph_url`, the
                inspector will also let you drill into that node’s graph.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Selected node
                </div>
                <CardTitle className="text-base">{selectedNode.card_title}</CardTitle>
                {selectedNode.card_subtitle?.trim() ? (
                  <div className="text-sm text-muted-foreground">{selectedNode.card_subtitle}</div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {selectedNode.badges.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.badges.map((badge, index) => (
                    <Badge key={`${selectedNode.id}-inspector-badge-${index}`} variant="neutral">
                      {badge}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {canExploreSelectedNode ? (
                  <Button size="sm" onClick={() => onExploreGraph(selectedNode)}>
                    <Network className="h-3.5 w-3.5" />
                    Explore graph
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {summaryLoading ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading summary</span>
              </CardContent>
            </Card>
          ) : null}

          {summaryError ? (
            <Card>
              <CardContent className="py-4 text-sm text-danger">
                {formatMainSequenceError(summaryError)}
              </CardContent>
            </Card>
          ) : null}

          {summary ? (
            <MainSequenceEntitySummaryCard summary={summary} />
          ) : (
            <Card>
              <CardContent className="py-6">
                <div className="text-sm font-medium text-foreground">No summary available</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  This node does not expose a `summary_url`, so the inspector stops at the selected
                  node overview.
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
