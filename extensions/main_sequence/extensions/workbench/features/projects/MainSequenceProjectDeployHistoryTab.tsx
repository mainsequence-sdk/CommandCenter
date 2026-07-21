import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  History,
  Loader2,
  RefreshCw,
  Rocket,
  ScrollText,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

import {
  fetchDeploymentRun,
  fetchDeploymentRunLogs,
  formatMainSequenceError,
  listDeploymentRuns,
  mainSequenceRegistryPageSize,
  type DeploymentRunListRecord,
  type DeploymentRunLogEntry,
  type DeploymentRunRecord,
  type DeploymentRunTargetType,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

type DeploymentRunTargetFilter = "all" | "resource_release" | "project_executor" | "static_site";

const deploymentRunTargetFilters: Array<{
  label: string;
  value: DeploymentRunTargetFilter;
}> = [
  { label: "All", value: "all" },
  { label: "Resource releases", value: "resource_release" },
  { label: "Coding agents", value: "project_executor" },
  { label: "Static sites", value: "static_site" },
];

function formatStatusLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replaceAll("_", " ") : "Not available";
}

function normalizeDeploymentState(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isDeploymentRunActive(run: DeploymentRunListRecord | DeploymentRunRecord) {
  const state = normalizeDeploymentState(run.state);
  const phase = normalizeDeploymentState(run.phase);

  return (
    ["pending", "running"].includes(state) ||
    ["waiting_project_image", "waiting_runtime_ready"].includes(state) ||
    ["waiting_project_image", "waiting_runtime_ready"].includes(phase)
  );
}

function getDeploymentRunStateVariant(run: DeploymentRunListRecord | DeploymentRunRecord) {
  const state = normalizeDeploymentState(run.state);
  const outcome = normalizeDeploymentState(run.outcome);

  if (["deployed", "no_action", "success"].includes(state) || outcome === "success") {
    return "success" as const;
  }

  if (["skipped", "blocked", "failed", "cancelled"].includes(state) || outcome === "failed") {
    return "danger" as const;
  }

  if (isDeploymentRunActive(run)) {
    return state === "running" ? "primary" as const : "warning" as const;
  }

  return "neutral" as const;
}

function formatDateTime(value: string | null | undefined) {
  if (!value?.trim()) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatCommitSha(commitSha: string | null | undefined) {
  const trimmed = commitSha?.trim();

  if (!trimmed) {
    return "Commit unavailable";
  }

  return trimmed.length > 12 ? `${trimmed.slice(0, 12)}...` : trimmed;
}

function formatTargetType(value: DeploymentRunTargetType | null | undefined) {
  return formatStatusLabel(value);
}

function readDeploymentRunErrorField(
  error: DeploymentRunListRecord["error"],
  keys: string[],
) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error.trim() || null;
  }

  for (const key of keys) {
    const value = error[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getDeploymentRunFinishedLabel(run: DeploymentRunListRecord | DeploymentRunRecord) {
  if (run.finished_at) {
    return `Finished ${formatDateTime(run.finished_at)}`;
  }

  if (isDeploymentRunActive(run)) {
    return "Still in progress";
  }

  return "No finish timestamp";
}

function readLogEntryText(entry: DeploymentRunLogEntry) {
  if (typeof entry.text === "string" && entry.text.trim()) {
    return entry.text.trim();
  }

  if (typeof entry.message === "string" && entry.message.trim()) {
    return entry.message.trim();
  }

  return "";
}

function readLogEntrySource(entry: DeploymentRunLogEntry) {
  return entry.stream?.trim() || entry.source?.trim() || entry.level?.trim() || "log";
}

function DeploymentLogRows({ entries }: { entries: DeploymentRunLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
        No logs returned for this deployment run.
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="sticky top-0 bg-background/95 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Message</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const source = readLogEntrySource(entry);

            return (
              <tr
                key={`${entry.sequence ?? index}-${entry.timestamp ?? ""}`}
                className="border-t border-border/60"
              >
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDateTime(entry.timestamp)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={source === "stderr" ? "danger" : "neutral"}>
                    {source}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  {readLogEntryText(entry) || "No message"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MainSequenceProjectDeployHistoryTab({
  onOpenResourceReleaseDetail,
  projectUid,
}: {
  onOpenResourceReleaseDetail: (resourceReleaseUid: string) => void;
  projectUid: string;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedRunUid, setSelectedRunUid] = useState<string | null>(null);
  const [selectedTargetType, setSelectedTargetType] =
    useState<DeploymentRunTargetFilter>("all");
  const apiTargetType =
    selectedTargetType === "all" ? undefined : selectedTargetType;

  const deployHistoryQuery = useQuery({
    queryKey: [
      "main_sequence",
      "projects",
      "deploy-history",
      projectUid,
      selectedTargetType,
      pageIndex,
    ],
    queryFn: () =>
      listDeploymentRuns({
        projectUid,
        targetType: apiTargetType,
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
      }),
    enabled: Boolean(projectUid),
    refetchInterval: (query) =>
      query.state.data?.results.some((run) => isDeploymentRunActive(run))
        ? 5_000
        : false,
  });
  const runs = deployHistoryQuery.data?.results ?? [];
  const totalCount = deployHistoryQuery.data?.count ?? 0;
  const activeCount = useMemo(
    () => runs.filter((run) => isDeploymentRunActive(run)).length,
    [runs],
  );
  const selectedRunFromList = useMemo(
    () => runs.find((run) => run.uid === selectedRunUid) ?? null,
    [runs, selectedRunUid],
  );
  const runDetailQuery = useQuery({
    queryKey: [
      "main_sequence",
      "projects",
      "deploy-history",
      "deployment-run",
      selectedRunUid,
    ],
    queryFn: () => fetchDeploymentRun(selectedRunUid ?? ""),
    enabled: Boolean(selectedRunUid),
  });
  const runLogsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "projects",
      "deploy-history",
      "deployment-run",
      selectedRunUid,
      "logs",
    ],
    queryFn: () => fetchDeploymentRunLogs(selectedRunUid ?? ""),
    enabled: Boolean(selectedRunUid),
  });
  const selectedRun = runDetailQuery.data ?? selectedRunFromList;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / mainSequenceRegistryPageSize));

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalCount]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="h-4 w-4 text-muted-foreground" />
            Deploy history
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Deployment runs for this project.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-1">
            {deploymentRunTargetFilters.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                variant={selectedTargetType === filter.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setSelectedTargetType(filter.value);
                  setPageIndex(0);
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <Badge variant={activeCount > 0 ? "primary" : "neutral"}>
            {activeCount > 0 ? `${activeCount} active` : `${totalCount} runs`}
          </Badge>
          {deployHistoryQuery.isFetching && !deployHistoryQuery.isLoading ? (
            <Badge variant="neutral">Refreshing</Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void deployHistoryQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {deployHistoryQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading deploy history
          </div>
        </div>
      ) : null}

      {deployHistoryQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(deployHistoryQuery.error)}
        </div>
      ) : null}

      {!deployHistoryQuery.isLoading &&
      !deployHistoryQuery.isError &&
      runs.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
            <Rocket className="h-6 w-6" />
          </div>
          <div className="mt-4 text-sm font-medium text-foreground">No deployment runs yet</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Deployment runs for this project will appear here.
          </p>
        </div>
      ) : null}

      {!deployHistoryQuery.isLoading &&
      !deployHistoryQuery.isError &&
      runs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 pb-2">Run</th>
                <th className="px-4 pb-2">Target</th>
                <th className="px-4 pb-2">State</th>
                <th className="px-4 pb-2">Source</th>
                <th className="px-4 pb-2">Commit</th>
                <th className="px-4 pb-2">Timing</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const errorCode = readDeploymentRunErrorField(run.error, [
                  "error_code",
                  "code",
                ]);
                const errorDetail = readDeploymentRunErrorField(run.error, [
                  "error_detail",
                  "detail",
                ]);
                const failed = Boolean(errorCode) || Boolean(errorDetail);
                const canOpenResourceRelease =
                  run.target_type === "resource_release" && Boolean(run.target.uid);

                return (
                  <tr key={run.uid}>
                    <td className={getRegistryTableCellClassName(false, "left")}>
                      <div className="font-medium text-foreground">{run.uid}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {run.operation?.trim() || "Operation unavailable"}
                      </div>
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                        onClick={() => setSelectedRunUid(run.uid)}
                      >
                        <ScrollText className="h-3 w-3" />
                        Details
                      </button>
                    </td>
                    <td className={getRegistryTableCellClassName(false)}>
                      <div className="text-foreground">
                        {run.target.name?.trim() || run.target.uid}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatTargetType(run.target_type)}
                        {run.target.kind ? ` / ${formatStatusLabel(run.target.kind)}` : ""}
                      </div>
                      {canOpenResourceRelease ? (
                        <button
                          type="button"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                          onClick={() => onOpenResourceReleaseDetail(run.target.uid)}
                        >
                          <span>Open release</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      ) : null}
                    </td>
                    <td className={getRegistryTableCellClassName(false)}>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getDeploymentRunStateVariant(run)}>
                          {formatStatusLabel(run.state)}
                        </Badge>
                        {run.phase ? (
                          <Badge variant="neutral">{formatStatusLabel(run.phase)}</Badge>
                        ) : null}
                      </div>
                      {failed ? (
                        <div className="mt-2 rounded-[calc(var(--radius)-8px)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                          {errorCode ? <div className="font-medium">{errorCode}</div> : null}
                          {errorDetail ? <div>{errorDetail}</div> : null}
                        </div>
                      ) : null}
                    </td>
                    <td className={getRegistryTableCellClassName(false)}>
                      <div className="text-foreground">{formatStatusLabel(run.source)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {run.outcome?.trim() ? `Outcome ${formatStatusLabel(run.outcome)}` : "Outcome pending"}
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(false)}>
                      <div className="font-mono text-xs text-foreground">
                        {formatCommitSha(run.commit_sha)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {run.configuration_revision
                          ? `Configuration r${run.configuration_revision}`
                          : "Configuration pending"}
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(false, "right")}>
                      <div className="text-foreground">
                        {`Started ${formatDateTime(run.started_at ?? run.created_at)}`}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {getDeploymentRunFinishedLabel(run)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!deployHistoryQuery.isLoading &&
      !deployHistoryQuery.isError &&
      totalCount > mainSequenceRegistryPageSize ? (
        <MainSequenceRegistryPagination
          count={totalCount}
          itemLabel="runs"
          pageIndex={pageIndex}
          pageSize={mainSequenceRegistryPageSize}
          onPageChange={setPageIndex}
        />
      ) : null}

      <Dialog
        title="Deployment run details"
        open={Boolean(selectedRunUid)}
        onClose={() => setSelectedRunUid(null)}
        className="max-w-[min(900px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          {runDetailQuery.isLoading && !selectedRun ? (
            <div className="flex min-h-40 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading deployment run details
              </div>
            </div>
          ) : null}

          {runDetailQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(runDetailQuery.error)}
            </div>
          ) : null}

          {selectedRun ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    {selectedRun.target.name?.trim() || selectedRun.target.uid}
                  </div>
                  <div className="break-all text-xs text-muted-foreground">
                    {selectedRun.uid}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getDeploymentRunStateVariant(selectedRun)}>
                    {formatStatusLabel(selectedRun.state)}
                  </Badge>
                  {selectedRun.phase ? (
                    <Badge variant="neutral">{formatStatusLabel(selectedRun.phase)}</Badge>
                  ) : null}
                  <Badge variant="neutral">{formatStatusLabel(selectedRun.source)}</Badge>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Target
                  </div>
                  <div className="mt-1 break-all text-sm text-foreground">
                    {selectedRun.target.uid}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatTargetType(selectedRun.target_type)}
                    {selectedRun.target.kind ? ` / ${formatStatusLabel(selectedRun.target.kind)}` : ""}
                  </div>
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Commit
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-foreground">
                    {selectedRun.commit_sha || "Commit unavailable"}
                  </div>
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Created
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {formatDateTime(selectedRun.created_at)}
                  </div>
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Finished
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {formatDateTime(selectedRun.finished_at)}
                  </div>
                </div>
              </div>

              {selectedRun.error ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                    {typeof selectedRun.error === "string"
                      ? selectedRun.error
                      : JSON.stringify(selectedRun.error, null, 2)}
                  </pre>
                </div>
              ) : null}

              {"revision_context" in selectedRun ? (
                <section className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Run context</div>
                  <pre className="max-h-72 overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 font-mono text-xs text-muted-foreground">
                    {JSON.stringify(
                      {
                        revision_context: selectedRun.revision_context ?? {},
                        trigger_context: selectedRun.trigger_context ?? {},
                        artifact_context: selectedRun.artifact_context ?? {},
                        cleanup_context: selectedRun.cleanup_context ?? {},
                        result: selectedRun.result ?? {},
                        steps: selectedRun.steps ?? [],
                      },
                      null,
                      2,
                    )}
                  </pre>
                </section>
              ) : null}
            </>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              Logs
            </div>
            {runLogsQuery.isLoading ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading logs
              </div>
            ) : null}
            {runLogsQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(runLogsQuery.error)}
              </div>
            ) : null}
            {!runLogsQuery.isLoading && !runLogsQuery.isError ? (
              <DeploymentLogRows entries={runLogsQuery.data?.entries ?? []} />
            ) : null}
          </section>
        </div>
      </Dialog>
    </div>
  );
}
