import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, ArrowUpRight, Cpu, Loader2, TimerReset } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import {
  fetchJobRunSummary,
  formatMainSequenceError,
  listJobRuns,
  mainSequenceRegistryPageSize,
  type EntitySummaryHeader,
  type JobRunRecord,
  type SummaryField,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceJobRunLogsTab } from "./MainSequenceJobRunLogsTab";
import { MainSequenceJobRunResourceUsageSection } from "./MainSequenceJobRunResourceUsageSection";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not started";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatDuration(jobRun: JobRunRecord) {
  if (!jobRun.execution_start) {
    return "Pending";
  }

  const start = new Date(jobRun.execution_start).getTime();
  const end = jobRun.execution_end ? new Date(jobRun.execution_end).getTime() : Date.now();

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "Unknown";
  }

  const seconds = Math.round((end - start) / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

function getRunStatusVariant(status: string) {
  const normalized = status.trim().toUpperCase();

  if (["SUCCESS", "SUCCEEDED", "COMPLETED", "DONE", "FINISHED"].includes(normalized)) {
    return "success" as const;
  }

  if (["FAILED", "ERROR", "ABORTED", "CANCELLED"].includes(normalized)) {
    return "danger" as const;
  }

  if (["RUNNING", "STARTED", "ACTIVE"].includes(normalized)) {
    return "primary" as const;
  }

  if (["PENDING", "QUEUED", "CREATED"].includes(normalized)) {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getResponseStatusVariant(responseStatus: string | null) {
  const normalized = responseStatus?.trim().toUpperCase();

  if (!normalized) {
    return "neutral" as const;
  }

  if (normalized === "OK") {
    return "success" as const;
  }

  if (normalized === "ERROR") {
    return "danger" as const;
  }

  return "neutral" as const;
}

function formatCommandArgs(commandArgs: string[] | null | undefined) {
  if (!commandArgs || commandArgs.length === 0) {
    return "No command args";
  }

  return commandArgs.join(" ");
}

function getEntityIdFromSummaryHref(
  href: string | undefined,
  queryKeys: string[],
) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, "https://mainsequence.local");

    for (const queryKey of queryKeys) {
      const rawValue = url.searchParams.get(queryKey);
      const parsedValue = Number(rawValue ?? "");

      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return parsedValue;
      }
    }

    const pathnameSegments = url.pathname.split("/").filter(Boolean).reverse();

    for (const segment of pathnameSegments) {
      const parsedValue = Number(segment);

      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return parsedValue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getJobIdFromSummaryHref(href?: string) {
  return getEntityIdFromSummaryHref(href, ["job_id", "jobId"]);
}

function getProjectIdFromSummaryHref(href?: string) {
  return getEntityIdFromSummaryHref(href, ["project_id", "projectId"]);
}

function buildCommandArgsSummaryField(jobRun: JobRunRecord): SummaryField {
  return {
    key: "command_args",
    label: "Command args",
    value: jobRun.command_args ?? [],
    meta: formatCommandArgs(jobRun.command_args),
    kind: "code",
    icon: "code",
  };
}

function addCommandArgsToSummary(
  summary: EntitySummaryHeader,
  jobRun: JobRunRecord | null,
): EntitySummaryHeader {
  if (!jobRun) {
    return summary;
  }

  const hasCommandArgsField = [...summary.inline_fields, ...summary.highlight_fields].some(
    (field) => field.key === "command_args",
  );

  if (hasCommandArgsField) {
    return summary;
  }

  return {
    ...summary,
    highlight_fields: [...summary.highlight_fields, buildCommandArgsSummaryField(jobRun)],
  };
}

function buildFallbackJobRunSummary(jobRun: JobRunRecord): EntitySummaryHeader {
  return {
    entity: {
      id: jobRun.id,
      type: "job_run",
      title: jobRun.name,
    },
    badges: [
      {
        key: "status",
        label: jobRun.status,
        tone: getRunStatusVariant(jobRun.status),
      },
      ...(jobRun.response_status
        ? [
            {
              key: "response_status",
              label: jobRun.response_status,
              tone: getResponseStatusVariant(jobRun.response_status),
            },
          ]
        : []),
    ],
    inline_fields: [
      {
        key: "started_at",
        label: "Started",
        value: formatTimestamp(jobRun.execution_start),
        kind: "text",
        icon: "calendar",
      },
      {
        key: "ended_at",
        label: "Ended",
        value: jobRun.execution_end ? formatTimestamp(jobRun.execution_end) : "In progress",
        kind: "text",
        icon: "calendar",
      },
      {
        key: "triggered_by",
        label: "Triggered by",
        value: jobRun.triggered_by ?? "System",
        meta: jobRun.triggered_by_id ? `ID ${jobRun.triggered_by_id}` : "",
        kind: "text",
      },
    ],
    highlight_fields: [
      {
        key: "runtime",
        label: "Runtime",
        value: formatDuration(jobRun),
        kind: "text",
        icon: "timer",
      },
      {
        key: "run_identifier",
        label: "Run identifier",
        value: jobRun.unique_identifier,
        kind: "code",
        icon: "fingerprint",
      },
      {
        key: "commit_hash",
        label: "Commit",
        value: jobRun.commit_hash ?? "No commit hash",
        kind: jobRun.commit_hash ? "commit" : "text",
        icon: "git-commit",
      },
      buildCommandArgsSummaryField(jobRun),
    ],
    stats: [],
  };
}

export function MainSequenceJobRunsTab({
  jobId,
  onCloseJobRunDetail,
  onOpenJobDetail,
  onOpenJobRunDetail,
  onOpenProjectDetail,
  selectedJobRunId,
}: {
  jobId: number;
  onCloseJobRunDetail: () => void;
  onOpenJobDetail: (jobId: number) => void;
  onOpenJobRunDetail: (jobRunId: number) => void;
  onOpenProjectDetail: (projectId: number) => void;
  selectedJobRunId: number | null;
}) {
  const [filterValue, setFilterValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const deferredFilterValue = useDeferredValue(filterValue);

  const runsQuery = useQuery({
    queryKey: ["main_sequence", "jobs", "runs", jobId, pageIndex],
    queryFn: () =>
      listJobRuns(jobId, {
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
      }),
    enabled: jobId > 0,
  });

  const selectedJobRunFromList = useMemo(
    () => (runsQuery.data?.results ?? []).find((jobRun) => jobRun.id === selectedJobRunId) ?? null,
    [runsQuery.data?.results, selectedJobRunId],
  );

  const jobRunSummaryQuery = useQuery({
    queryKey: ["main_sequence", "jobs", "runs", "summary", selectedJobRunId],
    queryFn: () => fetchJobRunSummary(selectedJobRunId ?? 0),
    enabled: Boolean(selectedJobRunId),
  });

  useEffect(() => {
    setPageIndex(0);
  }, [deferredFilterValue, jobId]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((runsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, runsQuery.data?.count]);

  const filteredRuns = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (runsQuery.data?.results ?? []).filter((jobRun) => {
      if (!needle) {
        return true;
      }

      return [
        jobRun.name,
        jobRun.unique_identifier,
        String(jobRun.id),
        jobRun.status,
        jobRun.response_status ?? "",
        jobRun.triggered_by ?? "",
        jobRun.commit_hash ?? "",
        formatCommandArgs(jobRun.command_args),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, runsQuery.data?.results]);

  const jobRunSummary =
    jobRunSummaryQuery.data
      ? addCommandArgsToSummary(jobRunSummaryQuery.data, selectedJobRunFromList)
      : selectedJobRunFromList
        ? buildFallbackJobRunSummary(selectedJobRunFromList)
        : null;
  const jobRunTitle =
    jobRunSummary?.entity.title ??
    selectedJobRunFromList?.name ??
    (selectedJobRunId ? `Run ${selectedJobRunId}` : "Run");

  function handleSummaryFieldLink(field: SummaryField) {
    const projectLinkId = getProjectIdFromSummaryHref(field.href);
    if (projectLinkId) {
      onOpenProjectDetail(projectLinkId);
      return;
    }

    const jobLinkId = getJobIdFromSummaryHref(field.href);
    if (jobLinkId) {
      onOpenJobDetail(jobLinkId);
    }
  }

  if (selectedJobRunId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={onCloseJobRunDetail}
            >
              Runs
            </button>
            <span>/</span>
            <span className="text-foreground">{jobRunTitle}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onCloseJobRunDetail}>
            <ArrowLeft className="h-4 w-4" />
            Back to runs
          </Button>
        </div>

        {jobRunSummaryQuery.isLoading && !jobRunSummary ? (
          <Card>
            <CardContent className="flex min-h-48 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading run details
              </div>
            </CardContent>
          </Card>
        ) : null}

        {jobRunSummaryQuery.isError ? (
          <Card>
            <CardContent className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(jobRunSummaryQuery.error)}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {jobRunSummary ? (
          <>
            <MainSequenceEntitySummaryCard
              summary={jobRunSummary}
              onFieldLinkClick={handleSummaryFieldLink}
            />

            <MainSequenceJobRunResourceUsageSection
              points={jobRunSummary.extensions?.resource_usage_chart_data ?? []}
            />

            <Card>
              <CardHeader className="border-b border-border/70 pb-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                  >
                    Logs
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <MainSequenceJobRunLogsTab jobRunId={selectedJobRunId} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Job runs</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent executions for this job, queried from the job-run endpoint.
          </p>
        </div>
        <MainSequenceRegistrySearch
          accessory={<Badge variant="neutral">{`${runsQuery.data?.count ?? 0} runs`}</Badge>}
          value={filterValue}
          onChange={(event) => setFilterValue(event.target.value)}
          placeholder="Filter by run name, id, status, trigger, or commit"
          searchClassName="max-w-lg"
        />
      </div>

      {runsQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading runs
          </div>
        </div>
      ) : null}

      {runsQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(runsQuery.error)}
        </div>
      ) : null}

      {!runsQuery.isLoading && !runsQuery.isError && filteredRuns.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
            <Activity className="h-6 w-6" />
          </div>
          <div className="mt-4 text-sm font-medium text-foreground">No runs found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This job has no matching runs on the current page.
          </p>
        </div>
      ) : null}

      {!runsQuery.isLoading && !runsQuery.isError && filteredRuns.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 pb-2">Run</th>
                <th className="px-4 pb-2">Status</th>
                <th className="px-4 pb-2">Timing</th>
                <th className="px-4 pb-2">Triggered by</th>
                <th className="px-4 pb-2">Command args</th>
                <th className="px-4 pb-2">Resources</th>
                <th className="px-4 pb-2">Commit</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((jobRun) => (
                <tr key={jobRun.id}>
                  <td className="rounded-l-[18px] border border-border/70 bg-background/24 px-4 py-3">
                    <button
                      type="button"
                      className="group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                      onClick={() => onOpenJobRunDetail(jobRun.id)}
                      title={`Open ${jobRun.name}`}
                    >
                      <span className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                        {jobRun.name}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
                    </button>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      Run ID {jobRun.id} · {jobRun.unique_identifier}
                    </div>
                  </td>
                  <td className="border-y border-border/70 bg-background/24 px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getRunStatusVariant(jobRun.status)}>{jobRun.status}</Badge>
                      <Badge variant={getResponseStatusVariant(jobRun.response_status)}>
                        {jobRun.response_status ?? "No response"}
                      </Badge>
                    </div>
                  </td>
                  <td className="border-y border-border/70 bg-background/24 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <TimerReset className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-foreground">{formatDuration(jobRun)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatTimestamp(jobRun.execution_start)}
                        </div>
                        {jobRun.execution_end ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Ended {formatTimestamp(jobRun.execution_end)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="border-y border-border/70 bg-background/24 px-4 py-3">
                    <div className="text-foreground">{jobRun.triggered_by ?? "System"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {jobRun.triggered_by_id ? `User ${jobRun.triggered_by_id}` : "No user id"}
                    </div>
                  </td>
                  <td className="border-y border-border/70 bg-background/24 px-4 py-3">
                    <div className="max-w-64 truncate font-mono text-xs text-foreground">
                      {formatCommandArgs(jobRun.command_args)}
                    </div>
                  </td>
                  <td className="border-y border-border/70 bg-background/24 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Cpu className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-foreground">
                          CPU {jobRun.cpu_usage ?? "?"} / {jobRun.cpu_limit ?? "?"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Memory {jobRun.memory_usage ?? "?"} / {jobRun.memory_limit ?? "?"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="rounded-r-[18px] border border-border/70 bg-background/24 px-4 py-3">
                    <div className="font-mono text-xs text-foreground">
                      {jobRun.commit_hash ?? "No commit hash"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!runsQuery.isLoading && !runsQuery.isError && (runsQuery.data?.count ?? 0) > 0 ? (
        <MainSequenceRegistryPagination
          count={runsQuery.data?.count ?? 0}
          itemLabel="runs"
          pageIndex={pageIndex}
          pageSize={mainSequenceRegistryPageSize}
          onPageChange={setPageIndex}
        />
      ) : null}
    </div>
  );
}
