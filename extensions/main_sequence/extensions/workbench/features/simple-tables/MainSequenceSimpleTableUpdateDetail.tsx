import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TimeseriesAreaChart } from "@/components/ui/timeseries-area-chart";
import { useToast } from "@/components/ui/toaster";

import {
  fetchSimpleTableUpdateDetail,
  fetchSimpleTableUpdateRunConfiguration,
  formatMainSequenceError,
  listSimpleTableUpdateHistoricalUpdates,
  type EntitySummaryHeader,
  type SimpleTableHistoricalUpdateRecord,
  type SimpleTableUpdateRecord,
  type SimpleTableUpdateRunConfiguration,
  type SimpleTableUpdateRunConfigurationInput,
  updateSimpleTableUpdateRunConfiguration,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceSimpleTableUpdateDependencyGraph } from "./MainSequenceSimpleTableUpdateDependencyGraph";

export type SimpleTableUpdateDetailTabId = "details" | "graphs" | "historical-updates";

const simpleTableUpdateDetailTabs: Array<{
  id: SimpleTableUpdateDetailTabId;
  label: string;
}> = [
  { id: "details", label: "Details" },
  { id: "graphs", label: "Dependencies Graphs" },
  { id: "historical-updates", label: "Historical Updates" },
];

interface RunConfigurationFormState {
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

function getStatusValue(simpleTableUpdate: SimpleTableUpdateRecord) {
  const normalizedValue = simpleTableUpdate.update_details?.active_update_status?.trim();

  if (normalizedValue) {
    return normalizedValue;
  }

  return simpleTableUpdate.update_details?.active_update ? "ACTIVE" : "Idle";
}

function buildFallbackSimpleTableUpdateSummary(
  simpleTableUpdate: SimpleTableUpdateRecord,
): EntitySummaryHeader {
  return {
    entity: {
      id: simpleTableUpdate.id,
      type: "simple_table_update",
      title: simpleTableUpdate.update_hash,
    },
    badges: [
      {
        key: "visibility",
        label: simpleTableUpdate.open_for_everyone ? "Public" : "Private",
        tone: simpleTableUpdate.open_for_everyone ? "success" : "neutral",
      },
      {
        key: "status",
        label: getStatusValue(simpleTableUpdate),
        tone: simpleTableUpdate.update_details?.error_on_last_update ? "danger" : "info",
      },
    ],
    inline_fields: [
      {
        key: "simple_table",
        label: "Simple Table",
        value: simpleTableUpdate.remote_table?.storage_hash ?? "Unknown",
        kind: "code",
      },
      {
        key: "scheduler",
        label: "Scheduler",
        value:
          simpleTableUpdate.update_details?.active_update_scheduler === null ||
          simpleTableUpdate.update_details?.active_update_scheduler === undefined
            ? "Not assigned"
            : `Scheduler ${simpleTableUpdate.update_details.active_update_scheduler}`,
        kind: "text",
      },
    ],
    highlight_fields: [
      {
        key: "last_update",
        label: "Last update",
        value: formatDateTime(simpleTableUpdate.update_details?.last_update),
        kind: "datetime",
      },
      {
        key: "next_update",
        label: "Next update",
        value: formatDateTime(simpleTableUpdate.update_details?.next_update),
        kind: "datetime",
      },
    ],
    stats: [],
  };
}

function buildRunConfigurationFormState(
  runConfiguration?: SimpleTableUpdateRunConfiguration | null,
): RunConfigurationFormState {
  return {
    updateSchedule:
      runConfiguration?.update_schedule === null || runConfiguration?.update_schedule === undefined
        ? ""
        : formatJson(runConfiguration.update_schedule),
  };
}

function buildRunConfigurationInput(
  formState: RunConfigurationFormState,
): SimpleTableUpdateRunConfigurationInput {
  return {
    update_schedule: parseScheduleValue(formState.updateSchedule),
  };
}

function SimpleTableUpdateOverviewDetails({
  simpleTableUpdate,
}: {
  simpleTableUpdate: SimpleTableUpdateRecord;
}) {
  const details = simpleTableUpdate.update_details;

  const detailRows = [
    ["Update hash", simpleTableUpdate.update_hash],
    ["Visibility", simpleTableUpdate.open_for_everyone ? "Public" : "Private"],
    ["Dependencies linked", simpleTableUpdate.ogm_dependencies_linked ? "Yes" : "No"],
    ["Active update", details?.active_update ? "Yes" : "No"],
    ["Active update status", getStatusValue(simpleTableUpdate)],
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
    ["Related simple table", simpleTableUpdate.remote_table?.storage_hash ?? "Unknown"],
    ["Source class", simpleTableUpdate.remote_table?.source_class_name ?? "Unknown"],
  ];

  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Update details</CardTitle>
        <CardDescription>Read-only fields from the SimpleTableUpdate serializer.</CardDescription>
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

function SimpleTableUpdateBuildConfiguration({
  buildConfiguration,
}: {
  buildConfiguration: unknown;
}) {
  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Build configuration</CardTitle>
        <CardDescription>
          Raw build configuration returned by the SimpleTableUpdate detail serializer.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <pre className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
          {formatJson(buildConfiguration)}
        </pre>
      </CardContent>
    </Card>
  );
}

export function MainSequenceSimpleTableUpdateDetail({
  initialSimpleTableUpdate,
  simpleTableUpdateId,
  onClose,
  onOpenSimpleTableDetail,
  onSelectTab,
  selectedTabId,
}: {
  initialSimpleTableUpdate?: SimpleTableUpdateRecord | null;
  simpleTableUpdateId: number;
  onClose: () => void;
  onOpenSimpleTableDetail: (simpleTableId: number) => void;
  onSelectTab: (tabId: SimpleTableUpdateDetailTabId) => void;
  selectedTabId: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [runConfigurationForm, setRunConfigurationForm] = useState<RunConfigurationFormState>(
    buildRunConfigurationFormState(initialSimpleTableUpdate?.run_configuration),
  );
  const activeTabId: SimpleTableUpdateDetailTabId = simpleTableUpdateDetailTabs.some(
    (tab) => tab.id === selectedTabId,
  )
    ? (selectedTabId as SimpleTableUpdateDetailTabId)
    : "details";

  const detailQuery = useQuery({
    queryKey: ["main_sequence", "simple_tables", "updates", "detail", simpleTableUpdateId],
    queryFn: () => fetchSimpleTableUpdateDetail(simpleTableUpdateId),
    enabled: simpleTableUpdateId > 0,
  });
  const runConfigurationQuery = useQuery({
    queryKey: ["main_sequence", "simple_tables", "updates", "run_configuration", simpleTableUpdateId],
    queryFn: () => fetchSimpleTableUpdateRunConfiguration(simpleTableUpdateId),
    enabled: simpleTableUpdateId > 0,
  });
  const historicalUpdatesQuery = useQuery({
    queryKey: ["main_sequence", "simple_tables", "updates", "historical_updates", simpleTableUpdateId],
    queryFn: () => listSimpleTableUpdateHistoricalUpdates(simpleTableUpdateId, 100),
    enabled: simpleTableUpdateId > 0 && activeTabId === "historical-updates",
  });

  useEffect(() => {
    setRunConfigurationForm(buildRunConfigurationFormState(runConfigurationQuery.data));
  }, [runConfigurationQuery.data]);

  const updateRunConfigurationMutation = useMutation({
    mutationFn: (input: SimpleTableUpdateRunConfigurationInput) =>
      updateSimpleTableUpdateRunConfiguration(simpleTableUpdateId, input),
    onSuccess: async () => {
      toast({
        variant: "success",
        title: "Run configuration updated",
        description: "The simple table update run configuration was saved.",
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "simple_tables", "updates", "run_configuration", simpleTableUpdateId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "simple_tables", "updates", "detail", simpleTableUpdateId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "simple_tables", "updates"],
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

  const simpleTableUpdate = detailQuery.data ?? initialSimpleTableUpdate ?? null;
  const summary = simpleTableUpdate
    ? buildFallbackSimpleTableUpdateSummary(simpleTableUpdate)
    : null;
  const detailTitle =
    summary?.entity.title ?? simpleTableUpdate?.update_hash ?? `Simple table update ${simpleTableUpdateId}`;
  const linkedSimpleTableId =
    simpleTableUpdate?.remote_table?.id && Number.isFinite(simpleTableUpdate.remote_table.id)
      ? simpleTableUpdate.remote_table.id
      : null;

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
        .map((update: SimpleTableHistoricalUpdateRecord) => {
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
        <div className="flex flex-wrap gap-2">
          {linkedSimpleTableId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenSimpleTableDetail(linkedSimpleTableId)}
            >
              Open simple table
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            Back to local updates
          </Button>
        </div>
      </div>

      {detailQuery.isError && !summary ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(detailQuery.error)}
        </div>
      ) : null}

      {summary ? (
        <MainSequenceEntitySummaryCard summary={summary} />
      ) : (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading simple table update
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2">
            {simpleTableUpdateDetailTabs.map((tab) => (
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
              {detailQuery.isLoading && !simpleTableUpdate ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  Loading simple table update details
                </div>
              ) : null}

              {detailQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(detailQuery.error)}
                </div>
              ) : null}

              {simpleTableUpdate ? (
                <>
                  <SimpleTableUpdateOverviewDetails simpleTableUpdate={simpleTableUpdate} />
                  <SimpleTableUpdateBuildConfiguration
                    buildConfiguration={simpleTableUpdate.build_configuration}
                  />
                </>
              ) : null}

              <Card variant="nested">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Run configuration</CardTitle>
                  <CardDescription>
                    Dedicated run-configuration endpoint for this simple table update.
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
              <MainSequenceSimpleTableUpdateDependencyGraph
                direction="downstream"
                simpleTableUpdateId={simpleTableUpdateId}
              />
              <MainSequenceSimpleTableUpdateDependencyGraph
                direction="upstream"
                simpleTableUpdateId={simpleTableUpdateId}
              />
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
                          No historical updates were returned for this simple table update.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
