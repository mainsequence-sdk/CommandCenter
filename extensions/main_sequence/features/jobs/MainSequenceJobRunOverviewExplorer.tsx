import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  History,
  Loader2,
  Server,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  DashboardControlsProvider,
  DashboardDataControls,
  useDashboardControls,
} from "@/dashboards/DashboardControls";
import type { DashboardControlsConfig } from "@/dashboards/types";
import { cn } from "@/lib/utils";

import {
  formatMainSequenceError,
  listHistoricalJobRunOverview,
  listUpcomingJobRunOverview,
  type JobRunOverviewRow,
} from "../../api";

const upcomingHoursParam = "msJobRunUpcomingHours";

const jobRunExplorerControls: DashboardControlsConfig = {
  enabled: true,
  timeRange: {
    enabled: true,
    defaultRange: "24h",
    options: ["1h", "6h", "24h", "7d", "30d"],
  },
  refresh: {
    enabled: true,
    defaultIntervalMs: null,
    intervals: [null, 30_000, 60_000, 300_000],
  },
  actions: {
    enabled: false,
    share: false,
    view: false,
  },
};

const upcomingHourOptions = [
  { hours: 2, label: "Next 2H" },
  { hours: 6, label: "Next 6H" },
  { hours: 24, label: "Next 24H" },
] as const;

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatClusterUuid(value: unknown) {
  if (value === null || value === undefined || value === "" || value === 0) {
    return "No cluster UUID";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Cluster UUID unavailable";
  }
}

function formatClusterName(value: string) {
  const normalized = value.trim();

  if (!normalized || normalized.toLowerCase() === "none") {
    return "Unassigned";
  }

  return normalized;
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

  if (["PENDING", "QUEUED", "CREATED", "SCHEDULED"].includes(normalized)) {
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

function readNumberParam(value: string | null, fallback: number) {
  const parsedValue = Number(value ?? "");

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return fallback;
  }

  return parsedValue;
}

function getOverviewRowKey(row: JobRunOverviewRow) {
  return row.row_id || `${row.kind}-${row.id ?? row.job}-${row.execution_start}`;
}

function JobRunOverviewTable({
  description,
  emptyDescription,
  emptyTitle,
  error,
  icon: Icon,
  isLoading,
  rows,
  title,
  onOpenJobDetail,
  onOpenJobRunDetail,
}: {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  error: string | null;
  icon: typeof History;
  isLoading: boolean;
  rows: JobRunOverviewRow[];
  title: string;
  onOpenJobDetail: (jobId: number) => void;
  onOpenJobRunDetail: (jobId: number, jobRunId: number) => void;
}) {
  return (
    <Card className="min-h-[32rem]">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="neutral">{`${rows.length} rows`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading overview rows
            </div>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <div className="mt-4 text-sm font-medium text-foreground">{emptyTitle}</div>
            <p className="mt-2 text-sm text-muted-foreground">{emptyDescription}</p>
          </div>
        ) : null}

        {!isLoading && !error && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-4 pb-2">Run</th>
                  <th className="px-4 pb-2">Status</th>
                  <th className="px-4 pb-2">Execution start</th>
                  <th className="px-4 pb-2">Timing</th>
                  <th className="px-4 pb-2">Cluster</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={getOverviewRowKey(row)}>
                    <td className="rounded-l-[18px] border border-border/70 bg-background/24 px-4 py-3">
                      <div className="min-w-0">
                        {row.id ? (
                          <button
                            type="button"
                            className="group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                            onClick={() => onOpenJobRunDetail(row.job, row.id!)}
                            title={`Open ${row.name}`}
                          >
                            <span className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                              {row.name}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
                          </button>
                        ) : (
                          <div className="font-medium text-foreground">{row.name}</div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.id ? `Run ID ${row.id}` : "Scheduled row"} · Job {row.job}
                        </div>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                          onClick={() => onOpenJobDetail(row.job)}
                          title={`Open job ${row.job}`}
                        >
                          Related job
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="border-y border-border/70 bg-background/24 px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getRunStatusVariant(row.status)}>{row.status}</Badge>
                        {row.response_status ? (
                          <Badge variant={getResponseStatusVariant(row.response_status)}>
                            {row.response_status}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-y border-border/70 bg-background/24 px-4 py-3">
                      <div className="text-foreground">{formatTimestamp(row.execution_start)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.job_name}</div>
                    </td>
                    <td className="border-y border-border/70 bg-background/24 px-4 py-3">
                      <div className="text-foreground">{row.execution_time || "Not available"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.execution_end
                          ? `Ended ${formatTimestamp(row.execution_end)}`
                          : row.status.toUpperCase() === "SCHEDULED"
                            ? "Pending next scheduled execution"
                            : "Still running or waiting"}
                      </div>
                    </td>
                    <td className="rounded-r-[18px] border border-border/70 bg-background/24 px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Server className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-foreground">{formatClusterName(row.cluster_name)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatClusterUuid(row.cluster_uuid)}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MainSequenceJobRunOverviewExplorerContent({
  onClose,
  onOpenJobDetail,
  onOpenJobRunDetail,
}: {
  onClose: () => void;
  onOpenJobDetail: (jobId: number) => void;
  onOpenJobRunDetail: (jobId: number, jobRunId: number) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { rangeStartMs, rangeEndMs } = useDashboardControls();
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const rawUpcomingHours = readNumberParam(searchParams.get(upcomingHoursParam), 6);
  const upcomingHours = upcomingHourOptions.some((option) => option.hours === rawUpcomingHours)
    ? rawUpcomingHours
    : 6;
  const [leftPanelWidthPercent, setLeftPanelWidthPercent] = useState(50);
  const [isResizingPanels, setIsResizingPanels] = useState(false);

  function updateSearchParams(update: (nextParams: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }

  function setUpcomingHours(hours: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(upcomingHoursParam, String(hours));
    });
  }

  function resizePanels(clientX: number) {
    const container = splitContainerRef.current;

    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();

    if (rect.width <= 0) {
      return;
    }

    const nextWidthPercent = ((clientX - rect.left) / rect.width) * 100;
    const clampedWidthPercent = Math.min(70, Math.max(30, nextWidthPercent));

    setLeftPanelWidthPercent(clampedWidthPercent);
  }

  useEffect(() => {
    if (!isResizingPanels) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      resizePanels(event.clientX);
    }

    function handlePointerUp() {
      setIsResizingPanels(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizingPanels]);

  useEffect(() => {
    if (!isResizingPanels) {
      return undefined;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingPanels]);

  const historicalQuery = useQuery({
    queryKey: [
      "main_sequence",
      "jobs",
      "runs",
      "overview",
      "historical",
      rangeStartMs,
      rangeEndMs,
    ],
    queryFn: () =>
      listHistoricalJobRunOverview({
        start: new Date(rangeStartMs).toISOString(),
        end: new Date(rangeEndMs).toISOString(),
      }),
  });

  const upcomingQuery = useQuery({
    queryKey: ["main_sequence", "jobs", "runs", "overview", "upcoming", upcomingHours],
    queryFn: () =>
      listUpcomingJobRunOverview({
        hours: upcomingHours,
      }),
  });

  const historicalRows = useMemo(
    () =>
      [...(historicalQuery.data ?? [])].sort(
        (left, right) =>
          new Date(right.execution_start).getTime() - new Date(left.execution_start).getTime(),
      ),
    [historicalQuery.data],
  );

  const upcomingRows = useMemo(
    () =>
      [...(upcomingQuery.data ?? [])].sort((left, right) => {
        const statusRank = (row: JobRunOverviewRow) => {
          const normalized = row.status.trim().toUpperCase();

          if (normalized === "RUNNING") {
            return 0;
          }

          if (normalized === "PENDING") {
            return 1;
          }

          if (normalized === "SCHEDULED") {
            return 2;
          }

          return 3;
        };

        const rankDifference = statusRank(left) - statusRank(right);

        if (rankDifference !== 0) {
          return rankDifference;
        }

        return (
          new Date(left.execution_start).getTime() - new Date(right.execution_start).getTime()
        );
      }),
    [upcomingQuery.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence"
        title="Job Run Explorer"
        description="Historical executions on the left. Active, pending, and scheduled work on the right."
        actions={
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </Button>
        }
      />

      <DashboardDataControls
        controls={jobRunExplorerControls}
        leftActions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Upcoming horizon
            </span>
            {upcomingHourOptions.map((option) => (
              <Button
                key={option.hours}
                variant="outline"
                size="sm"
                className={cn(
                  upcomingHours === option.hours
                    ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
                    : undefined,
                )}
                onClick={() => setUpcomingHours(option.hours)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        }
      />

      <div
        ref={splitContainerRef}
        className="grid gap-6 xl:grid-cols-[minmax(0,var(--ms-job-run-left-width))_18px_minmax(0,var(--ms-job-run-right-width))] xl:gap-4"
        style={
          {
            "--ms-job-run-left-width": `${leftPanelWidthPercent}%`,
            "--ms-job-run-right-width": `${100 - leftPanelWidthPercent}%`,
          } as CSSProperties
        }
      >
        <JobRunOverviewTable
          title="Historical executions"
          description="Recent and historical runs for quick operational scanning."
          icon={History}
          rows={historicalRows}
          isLoading={historicalQuery.isLoading}
          error={historicalQuery.isError ? formatMainSequenceError(historicalQuery.error) : null}
          emptyTitle="No historical runs found"
          emptyDescription="Adjust the dashboard range to widen or narrow the time window."
          onOpenJobDetail={onOpenJobDetail}
          onOpenJobRunDetail={onOpenJobRunDetail}
        />
        <div className="hidden xl:flex xl:items-stretch xl:justify-center">
          <div
            role="separator"
            aria-label="Resize overview tables"
            aria-orientation="vertical"
            tabIndex={0}
            className={cn(
              "group flex w-full cursor-col-resize items-center justify-center rounded-full outline-none transition-colors",
              isResizingPanels ? "bg-primary/10" : "hover:bg-muted/50 focus-visible:bg-muted/50",
            )}
            onDoubleClick={() => setLeftPanelWidthPercent(50)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setLeftPanelWidthPercent((current) => Math.max(30, current - 4));
              }

              if (event.key === "ArrowRight") {
                event.preventDefault();
                setLeftPanelWidthPercent((current) => Math.min(70, current + 4));
              }

              if (event.key === "Home") {
                event.preventDefault();
                setLeftPanelWidthPercent(50);
              }
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              resizePanels(event.clientX);
              setIsResizingPanels(true);
            }}
          >
            <div className="flex h-16 w-2 items-center justify-center rounded-full bg-border/70 transition-colors group-hover:bg-primary/50 group-focus-visible:bg-primary/50">
              <div className="h-8 w-[3px] rounded-full bg-background/90" />
            </div>
          </div>
        </div>
        <JobRunOverviewTable
          title="Running, pending, and next scheduled"
          description="Current work plus the next executions inferred from the scheduler."
          icon={Clock3}
          rows={upcomingRows}
          isLoading={upcomingQuery.isLoading}
          error={upcomingQuery.isError ? formatMainSequenceError(upcomingQuery.error) : null}
          emptyTitle="No upcoming runs found"
          emptyDescription="There are no active or scheduled runs in the selected horizon."
          onOpenJobDetail={onOpenJobDetail}
          onOpenJobRunDetail={onOpenJobRunDetail}
        />
      </div>
    </div>
  );
}

export function MainSequenceJobRunOverviewExplorer({
  onClose,
  onOpenJobDetail,
  onOpenJobRunDetail,
}: {
  onClose: () => void;
  onOpenJobDetail: (jobId: number) => void;
  onOpenJobRunDetail: (jobId: number, jobRunId: number) => void;
}) {
  return (
    <DashboardControlsProvider controls={jobRunExplorerControls}>
      <MainSequenceJobRunOverviewExplorerContent
        onClose={onClose}
        onOpenJobDetail={onOpenJobDetail}
        onOpenJobRunDetail={onOpenJobRunDetail}
      />
    </DashboardControlsProvider>
  );
}
