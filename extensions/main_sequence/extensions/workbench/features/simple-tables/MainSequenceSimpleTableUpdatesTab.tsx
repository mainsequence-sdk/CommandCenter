import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, Loader2, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import {
  formatMainSequenceError,
  listSimpleTableUpdates,
  mainSequenceRegistryPageSize,
  type SimpleTableUpdateRecord,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import {
  MainSequenceSimpleTableUpdateDetail,
  type SimpleTableUpdateDetailTabId,
} from "./MainSequenceSimpleTableUpdateDetail";

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

function getSchedulerValue(simpleTableUpdate: SimpleTableUpdateRecord) {
  const schedulerId = simpleTableUpdate.update_details?.active_update_scheduler;

  if (schedulerId === null || schedulerId === undefined) {
    return "Not assigned";
  }

  return `Scheduler ${schedulerId}`;
}

export function MainSequenceSimpleTableUpdatesTab({
  onCloseSimpleTableUpdateDetail,
  onOpenSimpleTableDetail,
  onOpenSimpleTableUpdateDetail,
  onSelectSimpleTableUpdateTab,
  selectedSimpleTableUpdateId,
  selectedSimpleTableUpdateTabId,
  simpleTableId,
}: {
  onCloseSimpleTableUpdateDetail: () => void;
  onOpenSimpleTableDetail: (simpleTableId: number) => void;
  onOpenSimpleTableUpdateDetail: (simpleTableUpdateId: number) => void;
  onSelectSimpleTableUpdateTab: (tabId: SimpleTableUpdateDetailTabId) => void;
  selectedSimpleTableUpdateId: number | null;
  selectedSimpleTableUpdateTabId: string | null;
  simpleTableId: number;
}) {
  const [filterValue, setFilterValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const deferredFilterValue = useDeferredValue(filterValue);

  const simpleTableUpdatesQuery = useQuery({
    queryKey: ["main_sequence", "simple_tables", "updates", "list", simpleTableId, pageIndex],
    queryFn: () =>
      listSimpleTableUpdates(simpleTableId, {
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
      }),
    enabled: simpleTableId > 0,
  });

  useEffect(() => {
    setPageIndex(0);
  }, [deferredFilterValue, simpleTableId]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((simpleTableUpdatesQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, simpleTableUpdatesQuery.data?.count]);

  const filteredSimpleTableUpdates = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (simpleTableUpdatesQuery.data?.results ?? []).filter((simpleTableUpdate) => {
      if (!needle) {
        return true;
      }

      const runConfiguration =
        simpleTableUpdate.run_configuration ?? simpleTableUpdate.update_details?.run_configuration ?? null;

      return [
        String(simpleTableUpdate.id),
        simpleTableUpdate.update_hash,
        formatStatus(
          simpleTableUpdate.update_details?.active_update_status,
          simpleTableUpdate.update_details?.active_update,
        ),
        getSchedulerValue(simpleTableUpdate),
        formatScheduleValue(runConfiguration?.update_schedule),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, simpleTableUpdatesQuery.data?.results]);

  const selectedSimpleTableUpdateFromList = useMemo(
    () =>
      (simpleTableUpdatesQuery.data?.results ?? []).find(
        (simpleTableUpdate) => simpleTableUpdate.id === selectedSimpleTableUpdateId,
      ) ?? null,
    [selectedSimpleTableUpdateId, simpleTableUpdatesQuery.data?.results],
  );

  if (selectedSimpleTableUpdateId) {
    return (
      <MainSequenceSimpleTableUpdateDetail
        initialSimpleTableUpdate={selectedSimpleTableUpdateFromList}
        onClose={onCloseSimpleTableUpdateDetail}
        onOpenSimpleTableDetail={onOpenSimpleTableDetail}
        onSelectTab={onSelectSimpleTableUpdateTab}
        selectedTabId={selectedSimpleTableUpdateTabId}
        simpleTableUpdateId={selectedSimpleTableUpdateId}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Local update</div>
          <p className="mt-1 text-sm text-muted-foreground">
            SimpleTableUpdate rows linked to this simple table through the `remote_table` filter.
          </p>
        </div>
        <MainSequenceRegistrySearch
          accessory={
            <Badge variant="neutral">{`${simpleTableUpdatesQuery.data?.count ?? 0} local updates`}</Badge>
          }
          value={filterValue}
          onChange={(event) => setFilterValue(event.target.value)}
          placeholder="Filter by id, update hash, status, scheduler, or schedule"
          searchClassName="max-w-lg"
        />
      </div>

      {simpleTableUpdatesQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading local updates
          </div>
        </div>
      ) : null}

      {simpleTableUpdatesQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(simpleTableUpdatesQuery.error)}
        </div>
      ) : null}

      {!simpleTableUpdatesQuery.isLoading &&
      !simpleTableUpdatesQuery.isError &&
      filteredSimpleTableUpdates.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
            <Workflow className="h-6 w-6" />
          </div>
          <div className="mt-4 text-sm font-medium text-foreground">No local updates found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This simple table has no matching SimpleTableUpdate rows on the current page.
          </p>
        </div>
      ) : null}

      {!simpleTableUpdatesQuery.isLoading &&
      !simpleTableUpdatesQuery.isError &&
      filteredSimpleTableUpdates.length > 0 ? (
        <Card variant="nested">
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
                  {filteredSimpleTableUpdates.map((simpleTableUpdate) => {
                    const status = formatStatus(
                      simpleTableUpdate.update_details?.active_update_status,
                      simpleTableUpdate.update_details?.active_update,
                    );
                    const runConfiguration =
                      simpleTableUpdate.run_configuration ??
                      simpleTableUpdate.update_details?.run_configuration ??
                      null;

                    return (
                      <tr key={simpleTableUpdate.id}>
                        <td className="rounded-l-[18px] border border-border/70 bg-background/40 px-4 py-3 align-top">
                          <button
                            type="button"
                            className="text-left transition-colors hover:text-primary"
                            onClick={() => onOpenSimpleTableUpdateDetail(simpleTableUpdate.id)}
                          >
                            <div className="flex items-start gap-2">
                              <Activity className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-foreground">
                                  {simpleTableUpdate.update_hash}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Update ID {simpleTableUpdate.id}
                                </div>
                              </div>
                            </div>
                          </button>
                        </td>
                        <td className="border-y border-border/70 bg-background/40 px-4 py-3 align-top">
                          <Badge variant={getStatusVariant(status)}>{status}</Badge>
                        </td>
                        <td className="border-y border-border/70 bg-background/40 px-4 py-3 align-top">
                          <div className="text-foreground">
                            {formatDateTime(simpleTableUpdate.update_details?.last_update)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {simpleTableUpdate.update_details?.last_updated_by_user
                              ? `User ${simpleTableUpdate.update_details.last_updated_by_user}`
                              : "No user recorded"}
                          </div>
                        </td>
                        <td className="border-y border-border/70 bg-background/40 px-4 py-3 align-top">
                          <div className="flex items-start gap-2">
                            <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div className="text-foreground">
                              {formatDateTime(simpleTableUpdate.update_details?.next_update)}
                            </div>
                          </div>
                        </td>
                        <td className="border-y border-border/70 bg-background/40 px-4 py-3 align-top text-foreground">
                          {getSchedulerValue(simpleTableUpdate)}
                        </td>
                        <td className="rounded-r-[18px] border border-border/70 bg-background/40 px-4 py-3 align-top">
                          <div className="max-w-[280px] truncate text-foreground">
                            {formatScheduleValue(runConfiguration?.update_schedule)}
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

      {!simpleTableUpdatesQuery.isLoading &&
      !simpleTableUpdatesQuery.isError &&
      (simpleTableUpdatesQuery.data?.count ?? 0) > 0 ? (
        <MainSequenceRegistryPagination
          count={simpleTableUpdatesQuery.data?.count ?? 0}
          itemLabel="local updates"
          pageIndex={pageIndex}
          pageSize={mainSequenceRegistryPageSize}
          onPageChange={setPageIndex}
        />
      ) : null}
    </div>
  );
}
