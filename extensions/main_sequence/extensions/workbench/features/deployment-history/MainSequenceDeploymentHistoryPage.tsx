import { useEffect, useMemo, useState } from "react";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  RefreshCcw,
  ScrollText,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchDeploymentRun,
  fetchDeploymentRunLogs,
  formatMainSequenceError,
  listDeploymentRuns,
  mainSequenceRegistryPageSize,
  type DeploymentRunListRecord,
  type DeploymentRunLogEntry,
  type DeploymentRunRecord,
  type EntitySummaryHeader,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

const deploymentRunUidParam = "msDeploymentRunUid";

function normalizeRunToken(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function formatRunToken(value: string | null | undefined, fallback = "Not available") {
  const normalized = value?.trim();

  if (!normalized) {
    return fallback;
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatRunTimestamp(value: string | null | undefined, fallback = "Not recorded") {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return value || fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(timestamp);
}

function formatLogTimestamp(value: string | null | undefined) {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return value || "Timestamp unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
    timeZoneName: "short",
  }).format(timestamp);
}

function isDeploymentRunActive(run: DeploymentRunListRecord | DeploymentRunRecord) {
  const state = normalizeRunToken(run.state);
  const phase = normalizeRunToken(run.phase);

  return (
    ["pending", "running", "waiting_project_image", "waiting_runtime_ready"].includes(state) ||
    ["waiting_project_image", "waiting_runtime_ready"].includes(phase)
  );
}

function getRunBadgeVariant(run: DeploymentRunListRecord | DeploymentRunRecord) {
  const state = normalizeRunToken(run.state);
  const outcome = normalizeRunToken(run.outcome);

  if (["deployed", "no_action", "success"].includes(state) || outcome === "success") {
    return "success" as const;
  }

  if (["failed", "blocked", "skipped", "cancelled"].includes(state) || outcome === "failed") {
    return "danger" as const;
  }

  if (isDeploymentRunActive(run)) {
    return state === "running" ? "primary" as const : "warning" as const;
  }

  return "neutral" as const;
}

function DeploymentRunState({ run }: { run: DeploymentRunListRecord | DeploymentRunRecord }) {
  return (
    <Badge variant={getRunBadgeVariant(run)} className="whitespace-nowrap">
      {formatRunToken(run.state, "Unknown")}
    </Badge>
  );
}

function readRunErrorField(
  run: DeploymentRunListRecord | DeploymentRunRecord,
  keys: string[],
) {
  if (!run.error) {
    return null;
  }

  if (typeof run.error === "string") {
    return run.error.trim() || null;
  }

  for (const key of keys) {
    const value = run.error[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getRunTargetLabel(run: DeploymentRunListRecord | DeploymentRunRecord) {
  return run.target.name?.trim() || run.target.uid || "Unknown target";
}

function hasDistinctTargetKind(run: DeploymentRunListRecord | DeploymentRunRecord) {
  return (
    Boolean(run.target.kind?.trim()) &&
    normalizeRunToken(run.target.kind) !== normalizeRunToken(run.target_type)
  );
}

function formatCommitSha(value: string | null | undefined) {
  const commitSha = value?.trim();

  if (!commitSha) {
    return "Not recorded";
  }

  return commitSha.length > 12 ? commitSha.slice(0, 12) : commitSha;
}

function formatRunDuration(run: DeploymentRunListRecord | DeploymentRunRecord) {
  const startedAt = parseTimestamp(run.started_at ?? run.created_at);

  if (startedAt === null) {
    return "Not recorded";
  }

  const finishedAt = parseTimestamp(run.finished_at);

  if (finishedAt === null) {
    return isDeploymentRunActive(run) ? "In progress" : "Not recorded";
  }

  const durationSeconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));

  if (durationSeconds < 60) {
    return `${durationSeconds}s`;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function buildDeploymentRunSummary(run: DeploymentRunRecord): EntitySummaryHeader {
  return {
    entity: {
      id: run.uid,
      type: "deployment_run",
      title: getRunTargetLabel(run),
    },
    badges: [
      {
        key: "state",
        label: formatRunToken(run.state, "Unknown"),
        tone: getRunBadgeVariant(run),
      },
      {
        key: "target-type",
        label: formatRunToken(run.target_type, "Unknown target type"),
        tone: "neutral",
      },
    ],
    inline_fields: [
      {
        key: "run-uid",
        label: "Run UID",
        value: run.uid,
        kind: "code",
      },
      {
        key: "target-uid",
        label: "Target UID",
        value: run.target.uid,
        kind: "code",
      },
      {
        key: "operation",
        label: "Operation",
        value: formatRunToken(run.operation),
        kind: "text",
      },
    ],
    highlight_fields: [
      {
        key: "started",
        label: "Started",
        value: formatRunTimestamp(run.started_at ?? run.created_at),
        kind: "text",
        icon: "calendar",
      },
      {
        key: "finished",
        label: "Finished",
        value: formatRunTimestamp(
          run.finished_at,
          isDeploymentRunActive(run) ? "In progress" : "Not recorded",
        ),
        kind: "text",
        icon: "calendar",
      },
      {
        key: "source",
        label: "Trigger",
        value: formatRunToken(run.source),
        kind: "text",
      },
      {
        key: "commit",
        label: "Commit",
        value: run.commit_sha || "Not recorded",
        kind: "code",
        icon: "git-commit",
      },
    ],
    stats: [
      {
        key: "duration",
        label: "Duration",
        display: formatRunDuration(run),
        value: formatRunDuration(run),
        kind: "text",
      },
      {
        key: "phase",
        label: "Phase",
        display: formatRunToken(run.phase),
        value: run.phase ?? null,
        kind: "text",
      },
      {
        key: "outcome",
        label: "Outcome",
        display: formatRunToken(run.outcome),
        value: run.outcome ?? null,
        kind: "text",
      },
      {
        key: "configuration-revision",
        label: "Configuration",
        display:
          run.configuration_revision === null || run.configuration_revision === undefined
            ? "Not recorded"
            : `Revision ${run.configuration_revision}`,
        value: run.configuration_revision ?? null,
        kind: "text",
      },
    ],
  };
}

function readLogMessage(entry: DeploymentRunLogEntry) {
  return entry.text?.trim() || entry.message?.trim() || "No message";
}

function readLogSource(entry: DeploymentRunLogEntry) {
  return entry.source?.trim() || entry.stream?.trim() || entry.level?.trim() || "log";
}

function getLogSourceVariant(entry: DeploymentRunLogEntry) {
  const source = readLogSource(entry).toLowerCase();
  const level = entry.level?.trim().toLowerCase() ?? "";

  return ["stderr", "error", "critical", "fatal"].includes(source) ||
    ["error", "critical", "fatal"].includes(level)
    ? "danger" as const
    : "neutral" as const;
}

function sortLogEntries(entries: DeploymentRunLogEntry[]) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftTimestamp = parseTimestamp(left.entry.timestamp);
      const rightTimestamp = parseTimestamp(right.entry.timestamp);

      if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
        return leftTimestamp - rightTimestamp;
      }

      const leftSequence = Number(left.entry.sequence);
      const rightSequence = Number(right.entry.sequence);

      if (Number.isFinite(leftSequence) && Number.isFinite(rightSequence) && leftSequence !== rightSequence) {
        return leftSequence - rightSequence;
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function DeploymentLogStream({ entries }: { entries: DeploymentRunLogEntry[] }) {
  const orderedEntries = useMemo(() => sortLogEntries(entries), [entries]);

  if (orderedEntries.length === 0) {
    return (
      <div className="border border-dashed border-border/70 px-5 py-12 text-center text-sm text-muted-foreground">
        No log lines were returned for this deployment.
      </div>
    );
  }

  return (
    <div className="max-h-[min(58vh,640px)] overflow-auto border border-border/70 bg-background/45">
      <div className="min-w-0">
        <div className="sticky top-0 z-[1] hidden grid-cols-[220px_110px_minmax(0,1fr)] border-b border-border/70 bg-background/95 px-3 py-2 text-[11px] font-medium uppercase text-muted-foreground backdrop-blur md:grid">
          <div>Timestamp</div>
          <div>Source</div>
          <div>Message</div>
        </div>
        <div role="log" aria-label="Deployment log lines">
          {orderedEntries.map((entry, index) => (
            <div
              key={`${entry.sequence ?? index}-${entry.timestamp ?? ""}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-border/45 px-3 py-2 font-mono text-xs leading-5 last:border-b-0 hover:bg-muted/25 md:grid-cols-[220px_110px_minmax(0,1fr)] md:gap-0"
            >
              <time className="whitespace-nowrap text-muted-foreground" dateTime={entry.timestamp ?? undefined}>
                {formatLogTimestamp(entry.timestamp)}
              </time>
              <div>
                <Badge variant={getLogSourceVariant(entry)} className="max-w-[96px] truncate font-sans">
                  {readLogSource(entry)}
                </Badge>
              </div>
              <pre className="col-span-2 min-w-0 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-foreground md:col-span-1">
                {readLogMessage(entry)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MainSequenceDeploymentHistoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pageIndex, setPageIndex] = useState(0);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedRunUid = searchParams.get(deploymentRunUidParam)?.trim() ?? "";
  const isDeploymentDetailOpen = selectedRunUid.length > 0;

  const deploymentRunsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "deployment-history",
      "deployment-runs",
      pageIndex,
    ],
    queryFn: () =>
      listDeploymentRuns({
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
      }),
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.results.some((run) => isDeploymentRunActive(run)) ? 5_000 : false,
  });

  const deploymentRuns = deploymentRunsQuery.data?.results ?? [];
  const totalCount = deploymentRunsQuery.data?.count ?? 0;
  const selectedRunFromList = useMemo(
    () => deploymentRuns.find((run) => run.uid === selectedRunUid) ?? null,
    [deploymentRuns, selectedRunUid],
  );
  const runDetailQuery = useQuery({
    queryKey: [
      "main_sequence",
      "deployment-history",
      "deployment-run",
      selectedRunUid,
    ],
    queryFn: () => fetchDeploymentRun(selectedRunUid ?? ""),
    enabled: Boolean(selectedRunUid),
    refetchInterval: (query) => {
      const run = query.state.data ?? selectedRunFromList;
      return run && isDeploymentRunActive(run) ? 5_000 : false;
    },
  });
  const selectedRun = runDetailQuery.data ?? null;
  const runLogsQuery = useInfiniteQuery({
    queryKey: [
      "main_sequence",
      "deployment-history",
      "deployment-run",
      selectedRunUid,
      "logs",
    ],
    queryFn: ({ pageParam }) => fetchDeploymentRunLogs(selectedRunUid ?? "", pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(selectedRunUid),
    refetchInterval: selectedRun && isDeploymentRunActive(selectedRun) ? 5_000 : false,
  });
  const logEntries = useMemo(
    () => runLogsQuery.data?.pages.flatMap((page) => page.entries) ?? [],
    [runLogsQuery.data?.pages],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / mainSequenceRegistryPageSize));

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalCount]);

  function updateSearchParams(update: (nextParams: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: false },
    );
  }

  function openDeploymentDetail(runUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(deploymentRunUidParam, runUid);
    });
  }

  function closeDeploymentDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(deploymentRunUidParam);
    });
  }

  if (isDeploymentDetailOpen) {
    const detailTitle = selectedRun
      ? getRunTargetLabel(selectedRun)
      : selectedRunFromList
        ? getRunTargetLabel(selectedRunFromList)
        : `Deployment ${selectedRunUid}`;
    const errorCode = selectedRun
      ? readRunErrorField(selectedRun, ["error_code", "code"])
      : null;
    const errorDetail = selectedRun
      ? readRunErrorField(selectedRun, ["error_detail", "detail", "message"])
      : null;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={closeDeploymentDetail}
            >
              Deployment History
            </button>
            <span>/</span>
            <span className="text-foreground">{detailTitle}</span>
          </div>
          <Button variant="outline" size="sm" onClick={closeDeploymentDetail}>
            <ArrowLeft className="h-4 w-4" />
            Back to deployment history
          </Button>
        </div>

        {runDetailQuery.isLoading && !selectedRun ? (
          <Card>
            <CardContent className="flex min-h-48 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading deployment details
              </div>
            </CardContent>
          </Card>
        ) : null}

        {runDetailQuery.isError ? (
          <Card>
            <CardContent className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(runDetailQuery.error)}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {selectedRun ? (
          <>
            <MainSequenceEntitySummaryCard summary={buildDeploymentRunSummary(selectedRun)} />

            {selectedRun.error ? (
              <Card>
                <CardContent className="pt-5">
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {errorCode ? <div className="font-medium">{errorCode}</div> : null}
                    {errorDetail ? <div className="mt-1">{errorDetail}</div> : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ScrollText className="h-4 w-4 text-muted-foreground" />
                      Deployment logs
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Timestamped log entries for this deployment run.
                    </p>
                  </div>
                  {runLogsQuery.isFetching && !runLogsQuery.isLoading ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Updating
                    </div>
                  ) : null}
                </div>

                {runLogsQuery.isLoading ? (
                  <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading log entries
                  </div>
                ) : null}

                {runLogsQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatMainSequenceError(runLogsQuery.error)}
                  </div>
                ) : null}

                {!runLogsQuery.isLoading && !runLogsQuery.isError ? (
                  <DeploymentLogStream entries={logEntries} />
                ) : null}

                {runLogsQuery.hasNextPage ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={runLogsQuery.isFetchingNextPage}
                      onClick={() => {
                        void runLogsQuery.fetchNextPage();
                      }}
                    >
                      {runLogsQuery.isFetchingNextPage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ScrollText className="h-4 w-4" />
                      )}
                      Load more logs
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Deployment History"
        description="All deployment runs and their timestamped logs."
        actions={
          <>
            <Badge variant="neutral">{`${totalCount} deployments`}</Badge>
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

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <div className="text-sm font-medium text-foreground">Deployment registry</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse deployments across resource releases, static sites, and coding agents.
            </p>
          </div>
          {deploymentRunsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading deployment history
              </div>
            </div>
          ) : null}

          {deploymentRunsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(deploymentRunsQuery.error)}
            </div>
          ) : null}

          {!deploymentRunsQuery.isLoading &&
          !deploymentRunsQuery.isError &&
          deploymentRuns.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <ScrollText className="mx-auto h-6 w-6 text-muted-foreground" />
              <div className="mt-3 text-sm font-medium text-foreground">
                No deployment runs found
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Deployment history will appear here.
              </p>
            </div>
          ) : null}

          {!deploymentRunsQuery.isLoading &&
          !deploymentRunsQuery.isError &&
          deploymentRuns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 pb-2">Target</th>
                    <th className="px-4 pb-2">Started</th>
                    <th className="px-4 pb-2">Type</th>
                    <th className="px-4 pb-2">Status</th>
                    <th className="px-4 pb-2">Trigger</th>
                    <th className="px-4 pb-2">Commit</th>
                    <th className="px-4 pb-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {deploymentRuns.map((run) => {
                    const errorCode = readRunErrorField(run, ["error_code", "code"]);

                    return (
                      <tr key={run.uid}>
                        <td className={getRegistryTableCellClassName(false, "left")}>
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="group max-w-[280px] text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                              onClick={() => openDeploymentDetail(run.uid)}
                              title={`Open ${getRunTargetLabel(run)} deployment`}
                            >
                              <span className="block truncate font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                                {getRunTargetLabel(run)}
                              </span>
                            </button>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Target UID {run.target.uid}
                            </div>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <div className="whitespace-nowrap text-foreground">
                            {formatRunTimestamp(run.started_at ?? run.created_at)}
                          </div>
                          <div className="mt-1 max-w-[220px] truncate font-mono text-[11px] text-muted-foreground">
                            Run UID {run.uid}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <div className="text-foreground">
                            {formatRunToken(run.target_type, "Unknown")}
                          </div>
                          {hasDistinctTargetKind(run) ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatRunToken(run.target.kind)}
                            </div>
                          ) : null}
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <DeploymentRunState run={run} />
                          {errorCode ? (
                            <div className="mt-1 text-xs text-danger">{errorCode}</div>
                          ) : null}
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <div className="text-foreground">{formatRunToken(run.source)}</div>
                        </td>
                        <td className={getRegistryTableCellClassName(false)}>
                          <div className="font-mono text-xs text-foreground">
                            {formatCommitSha(run.commit_sha)}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(false, "right")}>
                          <div className="whitespace-nowrap text-foreground">
                            {formatRunDuration(run)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!deploymentRunsQuery.isLoading &&
          !deploymentRunsQuery.isError &&
          totalCount > 0 ? (
            <MainSequenceRegistryPagination
              count={totalCount}
              itemLabel="deployments"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
