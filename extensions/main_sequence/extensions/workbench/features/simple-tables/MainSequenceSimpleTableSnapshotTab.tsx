import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  fetchSimpleTableDataSnapshot,
  formatMainSequenceError,
} from "../../../../common/api";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { DataNodePreviewTable } from "../../widgets/data-node-shared/DataNodePreviewTable";

const snapshotRowLimit = 100;

function buildSnapshotSearchText(row: Record<string, unknown>, columns: string[]) {
  return columns
    .map((column) => {
      const value = row[column];

      if (value === null || value === undefined) {
        return "";
      }

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }

      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(" ")
    .toLowerCase();
}

export function MainSequenceSimpleTableSnapshotTab({
  simpleTableId,
}: {
  simpleTableId: number;
}) {
  const [filterValue, setFilterValue] = useState("");
  const deferredFilterValue = useDeferredValue(filterValue);
  const snapshotQuery = useQuery({
    queryKey: ["main_sequence", "simple_tables", "snapshot", simpleTableId, snapshotRowLimit],
    queryFn: () =>
      fetchSimpleTableDataSnapshot(simpleTableId, {
        limit: snapshotRowLimit,
      }),
    enabled: simpleTableId > 0,
  });
  const snapshotColumns = snapshotQuery.data?.columns ?? [];
  const filteredRows = useMemo(() => {
    const rows = snapshotQuery.data?.rows ?? [];
    const needle = deferredFilterValue.trim().toLowerCase();

    if (!needle) {
      return rows;
    }

    return rows.filter((row) => buildSnapshotSearchText(row, snapshotColumns).includes(needle));
  }, [deferredFilterValue, snapshotColumns, snapshotQuery.data?.rows]);

  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-base">Data Snapshot</CardTitle>
            <CardDescription>
              Preview the latest rows returned by this simple table.
            </CardDescription>
          </div>
          <MainSequenceRegistrySearch
            accessory={<Badge variant="neutral">{`${filteredRows.length} rows loaded`}</Badge>}
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder="Filter the loaded snapshot rows"
            searchClassName="max-w-lg"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {snapshotQuery.isLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading data snapshot
            </div>
          </div>
        ) : null}

        {snapshotQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(snapshotQuery.error)}
          </div>
        ) : null}

        {!snapshotQuery.isLoading && !snapshotQuery.isError ? (
          <DataNodePreviewTable
            columns={snapshotColumns}
            rows={filteredRows}
            maxRows={snapshotRowLimit}
            emptyMessage="No snapshot rows are available for this simple table."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
