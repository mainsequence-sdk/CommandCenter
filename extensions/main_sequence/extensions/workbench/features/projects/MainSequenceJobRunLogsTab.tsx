import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LogTable } from "@/components/ui/log-table";

import { fetchJobRunLogs, formatMainSequenceError } from "../../../../common/api";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";

export function MainSequenceJobRunLogsTab({
  jobRunId,
}: {
  jobRunId: number;
}) {
  const [filterValue, setFilterValue] = useState("");
  const deferredFilterValue = useDeferredValue(filterValue);

  const logsQuery = useQuery({
    queryKey: ["main_sequence", "jobs", "runs", "logs", jobRunId],
    queryFn: () => fetchJobRunLogs(jobRunId),
    enabled: jobRunId > 0,
  });

  const filteredRows = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();
    const rows = logsQuery.data?.rows ?? [];

    return rows.filter((row) => {
      if (!needle) {
        return true;
      }

      return JSON.stringify(row).toLowerCase().includes(needle);
    });
  }, [deferredFilterValue, logsQuery.data?.rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Execution logs</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live log rows captured for this run from the backend log action.
          </p>
        </div>
        <MainSequenceRegistrySearch
          accessory={<Badge variant="neutral">{`${logsQuery.data?.rows.length ?? 0} rows`}</Badge>}
          value={filterValue}
          onChange={(event) => setFilterValue(event.target.value)}
          placeholder="Filter logs by any row content"
          searchClassName="max-w-lg"
        />
      </div>

      {logsQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading logs
          </div>
        </div>
      ) : null}

      {logsQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(logsQuery.error)}
        </div>
      ) : null}

      {!logsQuery.isLoading && !logsQuery.isError && filteredRows.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <div className="mt-4 text-sm font-medium text-foreground">No logs found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This run has no matching log rows.
          </p>
        </div>
      ) : null}

      {!logsQuery.isLoading && !logsQuery.isError && filteredRows.length > 0 ? (
        <LogTable logs={filteredRows} />
      ) : null}
    </div>
  );
}
