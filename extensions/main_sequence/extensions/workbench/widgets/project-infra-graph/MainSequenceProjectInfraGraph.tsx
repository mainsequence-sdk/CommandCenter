import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import {
  fetchMainSequenceSummaryByUrl,
  fetchProjectInfraGraph,
  fetchProjectInfraGraphByUrl,
  formatMainSequenceError,
} from "../../../../common/api";
import { ProjectInfraGraphCanvas } from "./ProjectInfraGraphCanvas";
import { ProjectInfraGraphInspector } from "./ProjectInfraGraphInspector";
import type { ProjectInfraGraphRecordNode, ProjectInfraGraphScope } from "./projectInfraGraphTypes";

function buildRootScope(projectId: number, commitSha?: string | null): ProjectInfraGraphScope {
  return {
    commitSha: commitSha ?? null,
    graphUrl: null,
    key: `project:${projectId}:infra:${commitSha ?? "root"}`,
    label: "Project Infrastructure",
  };
}

function buildDrilldownScope(node: ProjectInfraGraphRecordNode): ProjectInfraGraphScope {
  return {
    commitSha: null,
    graphUrl: node.graph_url,
    key: node.graph_url ?? node.id,
    label: node.card_title,
  };
}

export function MainSequenceProjectInfraGraph({
  initialCommitSha,
  projectId,
  variant = "page",
}: {
  initialCommitSha?: string | null;
  projectId: number;
  variant?: "page" | "widget";
}) {
  const compact = variant === "widget";
  const [history, setHistory] = useState<ProjectInfraGraphScope[]>(() => [
    buildRootScope(projectId, initialCommitSha),
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    setHistory([buildRootScope(projectId, initialCommitSha)]);
    setSelectedNodeId(null);
  }, [initialCommitSha, projectId]);

  const currentScope = history[history.length - 1] ?? buildRootScope(projectId, initialCommitSha);
  const graphQuery = useQuery({
    queryKey: ["main_sequence", "projects", "infra-graph", currentScope.key],
    queryFn: () =>
      currentScope.graphUrl
        ? fetchProjectInfraGraphByUrl(currentScope.graphUrl)
        : fetchProjectInfraGraph(projectId, { commitSha: currentScope.commitSha ?? undefined }),
    enabled: projectId > 0,
  });
  const selectedNode = useMemo(
    () => graphQuery.data?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graphQuery.data?.nodes, selectedNodeId],
  );
  const summaryQuery = useQuery({
    queryKey: ["main_sequence", "projects", "infra-graph", "summary", selectedNode?.summary_url ?? null],
    queryFn: () => fetchMainSequenceSummaryByUrl(selectedNode!.summary_url!),
    enabled: Boolean(selectedNode?.summary_url),
  });

  useEffect(() => {
    if (!graphQuery.data) {
      return;
    }

    setSelectedNodeId((currentSelectedNodeId) =>
      currentSelectedNodeId &&
      graphQuery.data.nodes.some((node) => node.id === currentSelectedNodeId)
        ? currentSelectedNodeId
        : null,
    );
  }, [graphQuery.data]);

  function handleExploreGraph(node: ProjectInfraGraphRecordNode) {
    if (!node.graph_url) {
      return;
    }

    setHistory((currentHistory) => [...currentHistory, buildDrilldownScope(node)]);
    setSelectedNodeId(null);
  }

  function handleGoBack() {
    setHistory((currentHistory) =>
      currentHistory.length > 1 ? currentHistory.slice(0, -1) : currentHistory,
    );
    setSelectedNodeId(null);
  }

  if (graphQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-[420px] items-center justify-center py-10 text-sm text-muted-foreground">
          Loading infrastructure graph
        </CardContent>
      </Card>
    );
  }

  if (graphQuery.isError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(graphQuery.error)}
      </div>
    );
  }

  if (!graphQuery.data) {
    return null;
  }

  if (graphQuery.data.nodes.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-[320px] items-center justify-center py-10">
          <div className="max-w-sm text-center">
            <div className="text-sm font-medium text-foreground">
              No infrastructure nodes were returned.
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              The backend returned an empty infra graph for this project scope.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={
        compact
          ? "grid gap-3 2xl:grid-cols-[minmax(0,1fr)_320px]"
          : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
      }
    >
      <ProjectInfraGraphCanvas
        key={currentScope.key}
        compact={compact}
        payload={graphQuery.data}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />
      <ProjectInfraGraphInspector
        canGoBack={history.length > 1}
        compact={compact}
        currentScope={currentScope}
        onExploreGraph={handleExploreGraph}
        onGoBack={handleGoBack}
        selectedNode={selectedNode}
        summary={summaryQuery.data}
        summaryError={summaryQuery.error}
        summaryLoading={summaryQuery.isLoading}
      />
    </div>
  );
}
