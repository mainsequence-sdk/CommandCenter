import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, Loader2, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import {
  formatMainSequenceError,
  listLocalTimeSeries,
  mainSequenceRegistryPageSize,
  type LocalTimeSerieRecord,
} from "../../api";
import { MainSequenceRegistryPagination } from "../../components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../components/MainSequenceRegistrySearch";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString();
}

function formatStatus(value?: string | null, activeUpdate?: boolean) {
  const normalized = value?.trim();

  if (normalized) {
    return normalized;
  }

  return activeUpdate ? "ACTIVE" : "Idle";
}

function getStatusVariant(status: string) {
  const normalized = status.trim().toUpperCase();

  if (["UPDATING", "RUNNING", "ACTIVE"].includes(normalized)) {
    return "primary" as const;
  }

  if (["ERROR", "FAILED"].includes(normalized)) {
    return "danger" as const;
  }

  if (["PENDING", "QUEUED"].includes(normalized)) {
    return "warning" as const;
  }

  if (["SUCCESS", "COMPLETED"].includes(normalized)) {
    return "success" as const;
  }

  return "neutral" as const;
}

function formatScheduleValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Manual";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Manual";
  }
}

function formatComputeValue(localTimeSerie: LocalTimeSerieRecord) {
  const runConfiguration =
    localTimeSerie.run_configuration ?? localTimeSerie.update_details?.run_configuration ?? null;

  const parts = [
    runConfiguration?.required_cpus ? `CPU ${runConfiguration.required_cpus}` : null,
    runConfiguration?.required_gpus ? `GPU ${runConfiguration.required_gpus}` : null,
    runConfiguration?.execution_time_out_seconds
      ? `Timeout ${runConfiguration.execution_time_out_seconds}s`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No run configuration";
}

function getSchedulerValue(localTimeSerie: LocalTimeSerieRecord) {
  const schedulerId = localTimeSerie.update_details?.active_update_scheduler;

  if (schedulerId === null || schedulerId === undefined) {
    return "Not assigned";
  }

  return `Scheduler ${schedulerId}`;
}

export function MainSequenceDataNodeLocalTimeSeriesTab({
  dataNodeId,
}: {
  dataNodeId: number;
}) {
  const [filterValue, setFilterValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const deferredFilterValue = useDeferredValue(filterValue);

  const localTimeSeriesQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "local_time_series", dataNodeId, pageIndex],
    queryFn: () =>
      listLocalTimeSeries(dataNodeId, {
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
      }),
    enabled: dataNodeId > 0,
  });

  useEffect(() => {
    setPageIndex(0);
  }, [deferredFilterValue, dataNodeId]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((localTimeSeriesQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [localTimeSeriesQuery.data?.count, pageIndex]);

  const filteredLocalTimeSeries = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (localTimeSeriesQuery.data?.results ?? []).filter((localTimeSerie) => {
      if (!needle) {
        return true;
      }

      const runConfiguration =
        localTimeSerie.run_configuration ?? localTimeSerie.update_details?.run_configuration ?? null;

      return [
        String(localTimeSerie.id),
        localTimeSerie.update_hash,
        formatStatus(
          localTimeSerie.update_details?.active_update_status,
          localTimeSerie.update_details?.active_update,
        ),
        getSchedulerValue(localTimeSerie),
        formatComputeValue(localTimeSerie),
        formatScheduleValue(runConfiguration?.update_schedule),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, localTimeSeriesQuery.data?.results]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Local update</div>
          <p className="mt-1 text-sm text-muted-foreground">
            LocalTimeSerie rows linked to this data node through the `remote_table` filter.
          </p>
        </div>
        <MainSequenceRegistrySearch
          accessory={
            <Badge variant="neutral">{`${localTimeSeriesQuery.data?.count ?? 0} local updates`}</Badge>
          }
          value={filterValue}
          onChange={(event) => setFilterValue(event.target.value)}
          placeholder="Filter by id, update hash, status, scheduler, or compute"
          searchClassName="max-w-lg"
        />
      </div>

      {localTimeSeriesQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading local updates
          </div>
        </div>
      ) : null}

      {localTimeSeriesQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(localTimeSeriesQuery.error)}
        </div>
      ) : null}

      {!localTimeSeriesQuery.isLoading &&
      !localTimeSeriesQuery.isError &&
      filteredLocalTimeSeries.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
            <Workflow className="h-6 w-6" />
          </div>
          <div className="mt-4 text-sm font-medium text-foreground">
            No local updates found
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This data node has no matching LocalTimeSerie rows on the current page.
          </p>
        </div>
      ) : null}

      {!localTimeSeriesQuery.isLoading &&
      !localTimeSeriesQuery.isError &&
      filteredLocalTimeSeries.length > 0 ? (
        <Card className="border border-border/70 bg-background/24">
          <CardContent className="pt-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 pb-2">Local update</th>
                    <th className="px-4 pb-2">Status</th>
                    <th className="px-4 pb-2">Last update</th>
                    <th className="px-4 pb-2">Next update</th>
                    <th className="px-4 pb-2">Scheduler</th>
                    <th className="px-4 pb-2">Run configuration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocalTimeSeries.map((localTimeSerie) => {
                    const status = formatStatus(
                      localTimeSerie.update_details?.active_update_status,
                      localTimeSerie.update_details?.active_update,
                    );
                    const runConfiguration =
                      localTimeSerie.run_configuration ??
                      localTimeSerie.update_details?.run_configuration ??
                      null;

                    return (
                      <tr key={localTimeSerie.id}>
                        <td className="rounded-l-[18px] border border-border/70 bg-background/40 px-4 py-3">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{localTimeSerie.update_hash}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              LocalTimeSerie ID {localTimeSerie.id}
                            </div>
                          </div>
                        </td>
                        <td className="border-y border-border/70 bg-background/40 px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getStatusVariant(status)}>{status}</Badge>
                            {localTimeSerie.open_for_everyone ? (
                              <Badge variant="success">Public</Badge>
                            ) : (
                              <Badge variant="neutral">Private</Badge>
                            )}
                            {localTimeSerie.ogm_dependencies_linked ? (
                              <Badge variant="primary">OGM linked</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-y border-border/70 bg-background/40 px-4 py-3">
                          <div className="flex items-start gap-2">
                            <Activity className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-foreground">
                                {formatDateTime(localTimeSerie.update_details?.last_update)}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {localTimeSerie.update_details?.last_updated_by_user
                                  ? `User ${localTimeSerie.update_details.last_updated_by_user}`
                                  : "No recorded user"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="border-y border-border/70 bg-background/40 px-4 py-3">
                          <div className="flex items-start gap-2">
                            <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-foreground">
                                {formatDateTime(localTimeSerie.update_details?.next_update)}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatScheduleValue(runConfiguration?.update_schedule)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="border-y border-border/70 bg-background/40 px-4 py-3 text-foreground">
                          {getSchedulerValue(localTimeSerie)}
                        </td>
                        <td className="rounded-r-[18px] border border-border/70 bg-background/40 px-4 py-3">
                          <div className="text-foreground">{formatComputeValue(localTimeSerie)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Retry{" "}
                            {runConfiguration?.retry_on_error
                              ? `enabled · wait ${runConfiguration.seconds_wait_on_retry ?? 0}s`
                              : "disabled"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!localTimeSeriesQuery.isLoading &&
      !localTimeSeriesQuery.isError &&
      (localTimeSeriesQuery.data?.count ?? 0) > 0 ? (
        <MainSequenceRegistryPagination
          count={localTimeSeriesQuery.data?.count ?? 0}
          itemLabel="local updates"
          pageIndex={pageIndex}
          pageSize={mainSequenceRegistryPageSize}
          onPageChange={setPageIndex}
        />
      ) : null}
    </div>
  );
}
