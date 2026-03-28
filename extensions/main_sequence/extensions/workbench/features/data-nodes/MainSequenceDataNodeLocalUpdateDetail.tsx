import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Save,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogTable, type LogTableEntry } from "@/components/ui/log-table";
import { Textarea } from "@/components/ui/textarea";
import { TimeseriesAreaChart } from "@/components/ui/timeseries-area-chart";
import { useToast } from "@/components/ui/toaster";

import {
  fetchLocalTimeSerieDetail,
  fetchLocalTimeSerieLogs,
  fetchLocalTimeSerieRunConfiguration,
  fetchLocalTimeSerieSummary,
  formatMainSequenceError,
  listLocalTimeSerieHistoricalUpdates,
  type EntitySummaryHeader,
  type LocalTimeSerieLogsGridRow,
  type LocalTimeSerieRecord,
  type LocalTimeSerieRunConfiguration,
  type LocalTimeSerieRunConfigurationInput,
  type SummaryField,
  updateLocalTimeSerieRunConfiguration,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceLocalUpdateDependencyGraph } from "./MainSequenceLocalUpdateDependencyGraph";

export type LocalUpdateDetailTabId = "details" | "graphs" | "historical-updates" | "logs";

const localUpdateDetailTabs: Array<{ id: LocalUpdateDetailTabId; label: string }> = [
  { id: "details", label: "Details" },
  { id: "graphs", label: "Dependencies Graphs" },
  { id: "historical-updates", label: "Historical Updates" },
  { id: "logs", label: "Logs" },
];

const localUpdateLogLevelOptions = [
  { id: "", label: "All" },
  { id: "info", label: "Info" },
  { id: "warning", label: "Warning" },
  { id: "error", label: "Error" },
  { id: "debug", label: "Debug" },
] as const;

interface RunConfigurationFormState {
  retryOnError: boolean;
  secondsWaitOnRetry: string;
  requiredCpus: string;
  requiredGpus: string;
  executionTimeoutSeconds: string;
  updateSchedule: string;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function formatDurationSeconds(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "Not available";
  }

  if (seconds < 60) {
    return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
  }

  if (seconds < 3600) {
    return `${(seconds / 60).toFixed(seconds >= 600 ? 0 : 1)}m`;
  }

  return `${(seconds / 3600).toFixed(seconds >= 36_000 ? 0 : 1)}h`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Not set";
  }
}

function formatJson(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "{}";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseOptionalNumber(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return parsedValue;
}

function parseScheduleValue(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return trimmedValue;
  }
}

function getStatusValue(localTimeSerie: LocalTimeSerieRecord) {
  const normalizedValue = localTimeSerie.update_details?.active_update_status?.trim();

  if (normalizedValue) {
    return normalizedValue;
  }

  return localTimeSerie.update_details?.active_update ? "ACTIVE" : "Idle";
}

function buildFallbackLocalUpdateSummary(localTimeSerie: LocalTimeSerieRecord): EntitySummaryHeader {
  return {
    entity: {
      id: localTimeSerie.id,
      type: "data_node_update",
      title: localTimeSerie.update_hash,
    },
    badges: [
      {
        key: "visibility",
        label: localTimeSerie.open_for_everyone ? "Public" : "Private",
        tone: localTimeSerie.open_for_everyone ? "success" : "neutral",
      },
      {
        key: "status",
        label: getStatusValue(localTimeSerie),
        tone: localTimeSerie.update_details?.error_on_last_update ? "danger" : "info",
      },
    ],
    inline_fields: [
      {
        key: "data_node",
        label: "Data node",
        value: localTimeSerie.data_node_storage?.storage_hash ?? "Unknown",
        kind: "code",
      },
      {
        key: "scheduler",
        label: "Scheduler",
        value:
          localTimeSerie.update_details?.active_update_scheduler === null ||
          localTimeSerie.update_details?.active_update_scheduler === undefined
            ? "Not assigned"
            : `Scheduler ${localTimeSerie.update_details.active_update_scheduler}`,
        kind: "text",
      },
    ],
    highlight_fields: [
      {
        key: "last_update",
        label: "Last update",
        value: formatDateTime(localTimeSerie.update_details?.last_update),
        kind: "datetime",
      },
      {
        key: "next_update",
        label: "Next update",
        value: formatDateTime(localTimeSerie.update_details?.next_update),
        kind: "datetime",
      },
    ],
    stats: [],
  };
}

function buildRunConfigurationFormState(
  runConfiguration?: LocalTimeSerieRunConfiguration | null,
): RunConfigurationFormState {
  return {
    retryOnError: Boolean(runConfiguration?.retry_on_error),
    secondsWaitOnRetry:
      runConfiguration?.seconds_wait_on_retry === null ||
      runConfiguration?.seconds_wait_on_retry === undefined
        ? ""
        : String(runConfiguration.seconds_wait_on_retry),
    requiredCpus:
      runConfiguration?.required_cpus === null || runConfiguration?.required_cpus === undefined
        ? ""
        : String(runConfiguration.required_cpus),
    requiredGpus:
      runConfiguration?.required_gpus === null || runConfiguration?.required_gpus === undefined
        ? ""
        : String(runConfiguration.required_gpus),
    executionTimeoutSeconds:
      runConfiguration?.execution_time_out_seconds === null ||
      runConfiguration?.execution_time_out_seconds === undefined
        ? ""
        : String(runConfiguration.execution_time_out_seconds),
    updateSchedule:
      runConfiguration?.update_schedule === null || runConfiguration?.update_schedule === undefined
        ? ""
        : formatJson(runConfiguration.update_schedule),
  };
}

function buildRunConfigurationInput(
  formState: RunConfigurationFormState,
): LocalTimeSerieRunConfigurationInput {
  return {
    retry_on_error: formState.retryOnError,
    seconds_wait_on_retry: parseOptionalNumber(formState.secondsWaitOnRetry),
    required_cpus: formState.requiredCpus.trim() || null,
    required_gpus: formState.requiredGpus.trim() || null,
    execution_time_out_seconds: parseOptionalNumber(formState.executionTimeoutSeconds),
    update_schedule: parseScheduleValue(formState.updateSchedule),
  };
}

function getDataNodeIdFromSummaryHref(href?: string) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, "https://mainsequence.local");
    const rawId =
      url.searchParams.get("dynamic_table_id") ??
      url.searchParams.get("msDataNodeId") ??
      url.searchParams.get("dynamicTableId");
    const parsedId = Number(rawId ?? "");

    if (Number.isFinite(parsedId) && parsedId > 0) {
      return parsedId;
    }
  } catch {
    return null;
  }

  return null;
}

function mapLogRowToEntry(row: LocalTimeSerieLogsGridRow, index: number): LogTableEntry {
  const detail =
    row.detail && typeof row.detail === "object"
      ? (row.detail as Record<string, unknown>)
      : null;

  return {
    id: `${row.timestamp ?? "log"}-${index}`,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
    level: typeof row.level === "string" ? row.level : null,
    message: typeof row.event === "string" && row.event.trim() ? row.event : "Log row",
    source:
      typeof detail?.filename === "string"
        ? detail.filename
        : typeof detail?.func_name === "string"
          ? detail.func_name
          : null,
    context: detail,
  };
}

function LocalUpdateOverviewDetails({
  localTimeSerie,
}: {
  localTimeSerie: LocalTimeSerieRecord;
}) {
  const details = localTimeSerie.update_details;

  const detailRows = [
    ["Update hash", localTimeSerie.update_hash],
    ["Visibility", localTimeSerie.open_for_everyone ? "Public" : "Private"],
    ["Dependencies linked", localTimeSerie.ogm_dependencies_linked ? "Yes" : "No"],
    ["Active update", details?.active_update ? "Yes" : "No"],
    ["Active update status", getStatusValue(localTimeSerie)],
    ["Error on last update", details?.error_on_last_update ? "Yes" : "No"],
    ["Update PID", details?.update_pid ?? "Not running"],
    ["Last update", formatDateTime(details?.last_update)],
    ["Next update", formatDateTime(details?.next_update)],
    [
      "Scheduler",
      details?.active_update_scheduler === null || details?.active_update_scheduler === undefined
        ? "Not assigned"
        : `Scheduler ${details.active_update_scheduler}`,
    ],
    ["Priority", details?.update_priority ?? "Not set"],
    [
      "Last updated by",
      details?.last_updated_by_user ? `User ${details.last_updated_by_user}` : "Not recorded",
    ],
    ["Related data node", localTimeSerie.data_node_storage?.storage_hash ?? "Unknown"],
    ["Source class", localTimeSerie.data_node_storage?.source_class_name ?? "Unknown"],
  ];

  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Update details</CardTitle>
        <CardDescription>Read-only fields from the LocalTimeSerie retrieve serializer.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {detailRows.map(([label, value]) => (
            <div key={label} className="border-b border-border/50 pb-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 text-sm text-foreground">{String(value)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LocalUpdateBuildConfiguration({
  buildConfiguration,
}: {
  buildConfiguration: unknown;
}) {
  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Build configuration</CardTitle>
        <CardDescription>Raw build configuration returned by the LocalTimeSerie detail serializer.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <pre className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
          {formatJson(buildConfiguration)}
        </pre>
      </CardContent>
    </Card>
  );
}

export function MainSequenceDataNodeLocalUpdateDetail({
  initialLocalTimeSerie,
  localTimeSerieId,
  onClose,
  onOpenDataNodeDetail,
  selectedTabId,
  onSelectTab,
}: {
  initialLocalTimeSerie?: LocalTimeSerieRecord | null;
  localTimeSerieId: number;
  onClose: () => void;
  onOpenDataNodeDetail: (dataNodeId: number) => void;
  selectedTabId: string | null;
  onSelectTab: (tabId: LocalUpdateDetailTabId) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [logFilterValue, setLogFilterValue] = useState("");
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>("");
  const [runConfigurationForm, setRunConfigurationForm] = useState<RunConfigurationFormState>(
    buildRunConfigurationFormState(initialLocalTimeSerie?.run_configuration),
  );
  const deferredLogFilterValue = useDeferredValue(logFilterValue);
  const activeTabId: LocalUpdateDetailTabId = localUpdateDetailTabs.some(
    (tab) => tab.id === selectedTabId,
  )
    ? (selectedTabId as LocalUpdateDetailTabId)
    : "details";

  const summaryQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "local_updates", "summary", localTimeSerieId],
    queryFn: () => fetchLocalTimeSerieSummary(localTimeSerieId),
    enabled: localTimeSerieId > 0,
  });
  const detailQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "local_updates", "detail", localTimeSerieId],
    queryFn: () => fetchLocalTimeSerieDetail(localTimeSerieId),
    enabled: localTimeSerieId > 0,
  });
  const runConfigurationQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "local_updates", "run_configuration", localTimeSerieId],
    queryFn: () => fetchLocalTimeSerieRunConfiguration(localTimeSerieId),
    enabled: localTimeSerieId > 0,
  });
  const historicalUpdatesQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "local_updates", "historical_updates", localTimeSerieId],
    queryFn: () => listLocalTimeSerieHistoricalUpdates(localTimeSerieId, 100),
    enabled: localTimeSerieId > 0 && activeTabId === "historical-updates",
  });
  const logsQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "local_updates", "logs", localTimeSerieId, selectedLogLevel],
    queryFn: () => fetchLocalTimeSerieLogs(localTimeSerieId, selectedLogLevel || undefined),
    enabled: localTimeSerieId > 0 && activeTabId === "logs",
  });

  useEffect(() => {
    setRunConfigurationForm(buildRunConfigurationFormState(runConfigurationQuery.data));
  }, [runConfigurationQuery.data]);

  const updateRunConfigurationMutation = useMutation({
    mutationFn: (input: LocalTimeSerieRunConfigurationInput) =>
      updateLocalTimeSerieRunConfiguration(localTimeSerieId, input),
    onSuccess: async () => {
      toast({
        variant: "success",
        title: "Run configuration updated",
        description: "The data node update run configuration was saved.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "data_nodes", "local_updates", "run_configuration", localTimeSerieId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "data_nodes", "local_updates", "detail", localTimeSerieId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "data_nodes", "local_updates", "summary", localTimeSerieId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "data_nodes", "local_time_series"],
        }),
      ]);
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Run configuration update failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const localTimeSerie = detailQuery.data ?? initialLocalTimeSerie ?? null;
  const summary =
    summaryQuery.data ?? (localTimeSerie ? buildFallbackLocalUpdateSummary(localTimeSerie) : null);
  const detailTitle =
    summary?.entity.title ?? localTimeSerie?.update_hash ?? `Data node update ${localTimeSerieId}`;

  const historicalUpdateMetrics = useMemo(() => {
    const updates = historicalUpdatesQuery.data ?? [];
    const durations = updates
      .map((update) => {
        const start = update.update_time_start ? Date.parse(update.update_time_start) : NaN;
        const end = update.update_time_end ? Date.parse(update.update_time_end) : NaN;

        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
          return null;
        }

        return (end - start) / 1000;
      })
      .filter((duration): duration is number => duration !== null);

    const averageDuration =
      durations.length > 0
        ? durations.reduce((currentValue, duration) => currentValue + duration, 0) / durations.length
        : null;

    return {
      averageDuration,
      completedCount: durations.length,
      errorCount: updates.filter((update) => update.error_on_update).length,
    };
  }, [historicalUpdatesQuery.data]);

  const historicalUpdateChartData = useMemo(
    () =>
      (historicalUpdatesQuery.data ?? [])
        .map((update) => {
          const start = update.update_time_start ? Date.parse(update.update_time_start) : NaN;
          const end = update.update_time_end ? Date.parse(update.update_time_end) : NaN;

          if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
            return null;
          }

          return {
            time: start,
            value: (end - start) / 1000,
          };
        })
        .filter((point): point is { time: number; value: number } => point !== null)
        .sort((left, right) => left.time - right.time),
    [historicalUpdatesQuery.data],
  );

  const filteredLogEntries = useMemo(() => {
    const needle = deferredLogFilterValue.trim().toLowerCase();
    const rows = logsQuery.data?.rows ?? [];
    const entries = rows.map(mapLogRowToEntry);

    return entries.filter((entry) => {
      if (!needle) {
        return true;
      }

      return JSON.stringify(entry).toLowerCase().includes(needle);
    });
  }, [deferredLogFilterValue, logsQuery.data?.rows]);

  function handleSummaryFieldLink(field: SummaryField) {
    const relatedDataNodeId = getDataNodeIdFromSummaryHref(field.href);

    if (relatedDataNodeId) {
      onOpenDataNodeDetail(relatedDataNodeId);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="transition-colors hover:text-foreground"
            onClick={onClose}
          >
            Local updates
          </button>
          <span>/</span>
          <span className="text-foreground">{detailTitle}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          Back to local updates
        </Button>
      </div>

      {summaryQuery.isError && !summary ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(summaryQuery.error)}
        </div>
      ) : null}

      {summary ? (
        <MainSequenceEntitySummaryCard
          summary={summary}
          onFieldLinkClick={handleSummaryFieldLink}
        />
      ) : (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading data node update
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2">
            {localUpdateDetailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  tab.id === activeTabId
                    ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                    : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                }
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {activeTabId === "details" ? (
            <div className="space-y-4">
              {detailQuery.isLoading && !localTimeSerie ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  Loading data node update details
                </div>
              ) : null}

              {detailQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(detailQuery.error)}
                </div>
              ) : null}

              {localTimeSerie ? (
                <>
                  <LocalUpdateOverviewDetails localTimeSerie={localTimeSerie} />
                  <LocalUpdateBuildConfiguration buildConfiguration={localTimeSerie.build_configuration} />
                </>
              ) : null}

              <Card variant="nested">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Run configuration</CardTitle>
                  <CardDescription>
                    Dedicated run-configuration endpoint for this data node update.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {runConfigurationQuery.isLoading ? (
                    <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                      Loading run configuration
                    </div>
                  ) : null}

                  {runConfigurationQuery.isError ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {formatMainSequenceError(runConfigurationQuery.error)}
                    </div>
                  ) : null}

                  {!runConfigurationQuery.isLoading && !runConfigurationQuery.isError ? (
                    <form
                      className="grid gap-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        updateRunConfigurationMutation.mutate(
                          buildRunConfigurationInput(runConfigurationForm),
                        );
                      }}
                    >
                      <label className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-3 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={runConfigurationForm.retryOnError}
                          onChange={(event) =>
                            setRunConfigurationForm((currentValue) => ({
                              ...currentValue,
                              retryOnError: event.target.checked,
                            }))
                          }
                        />
                        Retry on error
                      </label>

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            CPU
                          </span>
                          <Input
                            value={runConfigurationForm.requiredCpus}
                            onChange={(event) =>
                              setRunConfigurationForm((currentValue) => ({
                                ...currentValue,
                                requiredCpus: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            GPU
                          </span>
                          <Input
                            value={runConfigurationForm.requiredGpus}
                            onChange={(event) =>
                              setRunConfigurationForm((currentValue) => ({
                                ...currentValue,
                                requiredGpus: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Retry wait (seconds)
                          </span>
                          <Input
                            value={runConfigurationForm.secondsWaitOnRetry}
                            onChange={(event) =>
                              setRunConfigurationForm((currentValue) => ({
                                ...currentValue,
                                secondsWaitOnRetry: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Timeout (seconds)
                          </span>
                          <Input
                            value={runConfigurationForm.executionTimeoutSeconds}
                            onChange={(event) =>
                              setRunConfigurationForm((currentValue) => ({
                                ...currentValue,
                                executionTimeoutSeconds: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>

                      <label className="space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Update schedule
                        </span>
                        <Textarea
                          className="min-h-32"
                          value={runConfigurationForm.updateSchedule}
                          onChange={(event) =>
                            setRunConfigurationForm((currentValue) => ({
                              ...currentValue,
                              updateSchedule: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <div className="flex justify-end">
                        <Button type="submit" disabled={updateRunConfigurationMutation.isPending}>
                          {updateRunConfigurationMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save run configuration
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTabId === "graphs" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="min-h-[720px]">
                <MainSequenceLocalUpdateDependencyGraph
                  direction="downstream"
                  localTimeSerieId={localTimeSerieId}
                  variant="widget"
                />
              </div>
              <div className="min-h-[720px]">
                <MainSequenceLocalUpdateDependencyGraph
                  direction="upstream"
                  localTimeSerieId={localTimeSerieId}
                  variant="widget"
                />
              </div>
            </div>
          ) : null}

          {activeTabId === "historical-updates" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card variant="nested">
                  <CardContent className="pt-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Completed updates
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {historicalUpdateMetrics.completedCount}
                    </div>
                  </CardContent>
                </Card>
                <Card variant="nested">
                  <CardContent className="pt-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Average duration
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {formatDurationSeconds(historicalUpdateMetrics.averageDuration)}
                    </div>
                  </CardContent>
                </Card>
                <Card variant="nested">
                  <CardContent className="pt-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Error updates
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {historicalUpdateMetrics.errorCount}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {historicalUpdatesQuery.isLoading ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  Loading historical updates
                </div>
              ) : null}

              {historicalUpdatesQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(historicalUpdatesQuery.error)}
                </div>
              ) : null}

              {!historicalUpdatesQuery.isLoading && !historicalUpdatesQuery.isError ? (
                <>
                  <Card variant="nested">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Update duration history</CardTitle>
                      <CardDescription>
                        Duration is derived from update start and end timestamps.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <TimeseriesAreaChart
                        className="h-72"
                        data={historicalUpdateChartData}
                        emptyMessage="No completed historical updates available."
                        valueFormatter={(value) => `${value.toFixed(value >= 10 ? 0 : 1)} s`}
                      />
                    </CardContent>
                  </Card>

                  <Card variant="nested">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Historical update rows</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(historicalUpdatesQuery.data?.length ?? 0) > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                            <thead>
                              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                <th className="px-4 pb-2">Started</th>
                                <th className="px-4 pb-2">Ended</th>
                                <th className="px-4 pb-2">Duration</th>
                                <th className="px-4 pb-2">Result</th>
                                <th className="px-4 pb-2">Trace</th>
                                <th className="px-4 pb-2">User</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(historicalUpdatesQuery.data ?? []).map((update) => {
                                const start = update.update_time_start
                                  ? Date.parse(update.update_time_start)
                                  : NaN;
                                const end = update.update_time_end
                                  ? Date.parse(update.update_time_end)
                                  : NaN;
                                const duration =
                                  Number.isFinite(start) && Number.isFinite(end) && end >= start
                                    ? (end - start) / 1000
                                    : null;

                                return (
                                  <tr key={update.id}>
                                    <td className="rounded-l-[18px] border border-border/70 bg-background/40 px-4 py-3">
                                      {formatDateTime(update.update_time_start)}
                                    </td>
                                    <td className="border-y border-border/70 bg-background/40 px-4 py-3">
                                      {formatDateTime(update.update_time_end)}
                                    </td>
                                    <td className="border-y border-border/70 bg-background/40 px-4 py-3">
                                      {formatDurationSeconds(duration)}
                                    </td>
                                    <td className="border-y border-border/70 bg-background/40 px-4 py-3">
                                      <Badge variant={update.error_on_update ? "danger" : "success"}>
                                        {update.error_on_update ? "Error" : "Success"}
                                      </Badge>
                                    </td>
                                    <td className="border-y border-border/70 bg-background/40 px-4 py-3 text-foreground">
                                      {update.trace_id || "Not set"}
                                    </td>
                                    <td className="rounded-r-[18px] border border-border/70 bg-background/40 px-4 py-3 text-foreground">
                                      {update.updated_by_user ? `User ${update.updated_by_user}` : "Not recorded"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                          No historical updates were returned for this data node update.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>
          ) : null}

          {activeTabId === "logs" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Update logs</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Logs returned by the resource-scoped LocalTimeSerie logs endpoint.
                  </p>
                </div>
                <MainSequenceRegistrySearch
                  accessory={<Badge variant="neutral">{`${logsQuery.data?.rows.length ?? 0} rows`}</Badge>}
                  value={logFilterValue}
                  onChange={(event) => setLogFilterValue(event.target.value)}
                  placeholder="Filter logs by any row content"
                  searchClassName="max-w-lg"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {localUpdateLogLevelOptions.map((option) => (
                  <Button
                    key={option.id || "all"}
                    variant="outline"
                    size="sm"
                    className={
                      selectedLogLevel === option.id
                        ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
                        : undefined
                    }
                    onClick={() => setSelectedLogLevel(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {logsQuery.isLoading ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  Loading logs
                </div>
              ) : null}

              {logsQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(logsQuery.error)}
                </div>
              ) : null}

              {!logsQuery.isLoading && !logsQuery.isError && filteredLogEntries.length === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                  No logs matched the current level or filter.
                </div>
              ) : null}

              {!logsQuery.isLoading && !logsQuery.isError && filteredLogEntries.length > 0 ? (
                <LogTable logs={filteredLogEntries} />
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
