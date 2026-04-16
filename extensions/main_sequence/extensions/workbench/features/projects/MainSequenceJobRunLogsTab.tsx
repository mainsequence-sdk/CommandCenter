import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LogTable, type LogTableEntry } from "@/components/ui/log-table";

import {
  fetchJobRunLogs,
  formatMainSequenceError,
  type JobRunLogEntry,
} from "../../../../common/api";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";

function mapJobRunLogRowToEntry(row: JobRunLogEntry, index: number): LogTableEntry {
  const context: Record<string, unknown> = {
    ...row,
  };

  delete context.id;
  delete context.timestamp;
  delete context.level;
  delete context.source;
  delete context.message;
  delete context.summary;
  delete context.context;
  delete context.children;
  delete context.tags;
  delete context.status;
  delete context.durationMs;

  const filename = typeof row.filename === "string" && row.filename.trim() ? row.filename.trim() : null;
  const lineNumber = typeof row.lineno === "number" && Number.isFinite(row.lineno) ? row.lineno : null;
  const functionName =
    typeof row.func_name === "string" && row.func_name.trim() ? row.func_name.trim() : null;
  const source =
    filename ??
    functionName ??
    (typeof row.source === "string" && row.source.trim() ? row.source.trim() : null);
  const summaryParts = [
    filename ? `File: ${filename}` : null,
    lineNumber !== null ? `Line: ${lineNumber}` : null,
    functionName ? `Function: ${functionName}` : null,
  ].filter(Boolean);

  const rowContext = row.context && typeof row.context === "object" ? row.context : null;
  const mergedContext = {
    ...(Object.keys(context).length > 0 ? context : {}),
    ...(rowContext ?? {}),
  };

  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id : `${row.timestamp ?? "log"}-${index}`,
    timestamp: row.timestamp ?? null,
    level: typeof row.level === "string" ? row.level : null,
    message:
      (typeof row.event === "string" && row.event.trim() ? row.event : null) ??
      (typeof row.message === "string" && row.message.trim() ? row.message : null) ??
      "Log row",
    source,
    durationMs: typeof row.durationMs === "number" ? row.durationMs : null,
    status: typeof row.status === "string" ? row.status : null,
    summary:
      (typeof row.summary === "string" && row.summary.trim() ? row.summary : null) ??
      (summaryParts.length > 0 ? summaryParts.join(" · ") : null),
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : null,
    context: Object.keys(mergedContext).length > 0 ? mergedContext : null,
    children: Array.isArray(row.children)
      ? row.children.map((child, childIndex) => mapJobRunLogRowToEntry(child, childIndex))
      : null,
  };
}

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
    const mappedRows = rows.map(mapJobRunLogRowToEntry);

    return mappedRows.filter((row) => {
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
