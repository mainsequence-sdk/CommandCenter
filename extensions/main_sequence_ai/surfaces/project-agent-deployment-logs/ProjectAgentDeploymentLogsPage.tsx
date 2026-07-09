import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchProjectExecutorAutomaticDeploymentRuns,
  formatMainSequenceError,
  type ProjectExecutorAutomaticDeploymentRun,
} from "../../../main_sequence/common/api";

const mainSequenceProjectUidParam = "msProjectUid";

function normalizeSelectedProjectUid(rawValue: string | null) {
  const trimmed = rawValue?.trim();
  return trimmed ? trimmed : null;
}

function formatRunTimestamp(value: string | null | undefined, fallback = "Not recorded") {
  if (!value) {
    return fallback;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatRunToken(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getRunBadgeVariant(status: string) {
  switch (status) {
    case "deployed":
      return "success" as const;
    case "failed":
    case "blocked":
      return "danger" as const;
    case "skipped":
    case "waiting_project_image":
    case "waiting_executor_image":
      return "warning" as const;
    case "running":
    case "pending":
      return "primary" as const;
    case "no_action":
      return "secondary" as const;
    default:
      return "neutral" as const;
  }
}

function readResultMessage(run: ProjectExecutorAutomaticDeploymentRun) {
  const message = run.result?.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function getRunSummary(run: ProjectExecutorAutomaticDeploymentRun) {
  switch (run.status) {
    case "deployed":
      return "Deployment completed.";
    case "no_action":
      return "Already current, nothing changed.";
    case "waiting_project_image":
      return "Project image is still building.";
    case "waiting_executor_image":
      return "Executor image is still building.";
    case "skipped":
      return readResultMessage(run) || run.error_detail?.trim() || "Not eligible or disabled.";
    case "failed":
      return run.error_detail?.trim() || "Deployment failed.";
    case "running":
    case "pending":
      return `Current step: ${formatRunToken(run.current_step)}`;
    case "blocked":
      return run.error_detail?.trim() || readResultMessage(run) || "Deployment is blocked.";
    default:
      return run.error_detail?.trim() || readResultMessage(run) || `Status: ${formatRunToken(run.status)}`;
  }
}

function getRunAgentLabel(run: ProjectExecutorAutomaticDeploymentRun) {
  if (typeof run.agent_uid === "string" && run.agent_uid.trim()) {
    return run.agent_uid.trim();
  }

  if (typeof run.agent === "string" && run.agent.trim()) {
    return run.agent.trim();
  }

  if (run.agent && typeof run.agent === "object" && !Array.isArray(run.agent)) {
    const candidate = run.agent as Record<string, unknown>;

    for (const key of ["uid", "agent_uid", "name", "agent_unique_id"]) {
      const value = candidate[key];

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return "Unknown agent";
}

function DeploymentRunCard({ run }: { run: ProjectExecutorAutomaticDeploymentRun }) {
  const summary = getRunSummary(run);
  const startedAt = run.started_at ?? run.created_at;
  const finishedAt = run.finished_at ?? run.updated_at;
  const detailsPayload = {
    revision_context: run.revision_context ?? {},
    trigger_context: run.trigger_context ?? {},
    image_artifact_context: run.image_artifact_context ?? {},
    cleanup_context: run.cleanup_context ?? {},
    result: run.result ?? {},
  };

  return (
    <div className="rounded-[calc(var(--radius)-9px)] border border-border/65 bg-background/16 px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge className="px-2 py-0.5 text-[10px]" variant={getRunBadgeVariant(run.status)}>
              {formatRunToken(run.status)}
            </Badge>
            {run.automatic_deployment_source ? (
              <Badge className="px-2 py-0.5 text-[10px]" variant="neutral">
                {formatRunToken(run.automatic_deployment_source)}
              </Badge>
            ) : null}
            {run.error_code ? (
              <Badge className="px-2 py-0.5 text-[10px]" variant="danger">
                {run.error_code}
              </Badge>
            ) : null}
          </div>
          <div className="min-w-[180px] truncate text-sm font-medium text-foreground">
            {summary}
          </div>
          <div className="hidden min-w-0 flex-1 items-center gap-2 truncate font-mono text-[11px] text-muted-foreground lg:flex">
            <span className="truncate">Run {run.uid}</span>
            <span className="truncate">Agent {getRunAgentLabel(run)}</span>
            <span className="shrink-0">Step {formatRunToken(run.current_step)}</span>
            <span className="shrink-0">Attempts {run.attempts ?? "0"}</span>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground md:flex">
          <span>Started {formatRunTimestamp(startedAt)}</span>
          <span>Finished {formatRunTimestamp(finishedAt, "In progress")}</span>
        </div>
      </div>

      <details className="mt-1.5 rounded-[calc(var(--radius)-10px)] border border-border/55 bg-background/18 px-2 py-1 lg:hidden">
        <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
          Details
        </summary>
        <div className="mt-1 space-y-1 font-mono text-[11px] leading-4 text-muted-foreground">
          <div className="break-all">Run {run.uid}</div>
          <div className="break-all">Agent {getRunAgentLabel(run)}</div>
          <div>Step {formatRunToken(run.current_step)}</div>
          <div>Attempts {run.attempts ?? "0"}</div>
          <div>Started {formatRunTimestamp(startedAt)}</div>
          <div>Finished {formatRunTimestamp(finishedAt, "In progress")}</div>
        </div>
      </details>

      <details className="mt-1.5 rounded-[calc(var(--radius)-10px)] border border-border/55 bg-background/18 px-2 py-1">
        <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
          Run context
        </summary>
        <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-muted-foreground">
          {JSON.stringify(detailsPayload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function ProjectAgentDeploymentLogsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedProjectUid = normalizeSelectedProjectUid(searchParams.get(mainSequenceProjectUidParam));

  const deploymentRunsQuery = useQuery({
    queryKey: ["main_sequence_ai", "project-agent-deployment-logs", "automatic-deployment-runs", 20],
    queryFn: () =>
      fetchProjectExecutorAutomaticDeploymentRuns({
        ordering: "-created_at",
        limit: 20,
      }),
    staleTime: 30_000,
  });

  function navigateToWorkbenchProject() {
    const nextSearchParams = new URLSearchParams();

    if (selectedProjectUid) {
      nextSearchParams.set(mainSequenceProjectUidParam, selectedProjectUid);
      nextSearchParams.set("msTab", "code");
    }

    navigate({
      pathname: getAppPath("main-sequence-foundry", "projects"),
      search: nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : "",
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Main Sequence AI"
        title="Deployment Logs"
        description="Review automatic project-agent deployment runs scoped to your authenticated user."
        actions={
          <>
            <Button type="button" variant="outline" onClick={navigateToWorkbenchProject}>
              <ArrowLeft className="h-4 w-4" />
              Workbench project
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={deploymentRunsQuery.isFetching}
              onClick={() => {
                void deploymentRunsQuery.refetch();
              }}
            >
              {deploymentRunsQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </>
        }
      />

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Automatic Deployment Runs</CardTitle>
          <CardDescription>
            Latest automatic project-agent deployment activity, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {deploymentRunsQuery.isLoading ? (
            <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-5 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading deployment logs
            </div>
          ) : null}

          {deploymentRunsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(deploymentRunsQuery.error)}
            </div>
          ) : null}

          {!deploymentRunsQuery.isLoading &&
          !deploymentRunsQuery.isError &&
          (deploymentRunsQuery.data ?? []).length === 0 ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/18 px-5 py-8 text-sm text-muted-foreground">
              No automatic deployment runs found.
            </div>
          ) : null}

          {(deploymentRunsQuery.data ?? []).map((run) => (
            <DeploymentRunCard key={run.uid} run={run} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
