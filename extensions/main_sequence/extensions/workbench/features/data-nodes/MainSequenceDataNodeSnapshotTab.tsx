import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeDetail,
  fetchDataNodeLastObservation,
  formatMainSequenceError,
  type DataNodeDetail,
  type DataNodeLastObservation,
} from "../../../../common/api";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { DataNodePreviewTable } from "../../widgets/data-node-shared/DataNodePreviewTable";
import { buildDataNodeFieldOptions } from "../../widgets/data-node-shared/dataNodeShared";
import { resolveDataNodeWidgetPreviewAnchorMs } from "../../widgets/data-node-shared/dataNodeWidgetSource";

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

function getSnapshotColumns(
  detail?: DataNodeDetail | null,
  lastObservation?: DataNodeLastObservation,
) {
  const metadataColumns = buildDataNodeFieldOptions(detail).map((field) => field.key);

  if (metadataColumns.length > 0) {
    return metadataColumns;
  }

  if (lastObservation && typeof lastObservation === "object") {
    return Object.keys(lastObservation).filter((key) => key.trim().length > 0);
  }

  return [];
}

export function MainSequenceDataNodeSnapshotTab({
  dataNodeId,
}: {
  dataNodeId: number;
}) {
  const [filterValue, setFilterValue] = useState("");
  const deferredFilterValue = useDeferredValue(filterValue);
  const detailQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "detail", dataNodeId],
    queryFn: () => fetchDataNodeDetail(dataNodeId),
    enabled: dataNodeId > 0,
    staleTime: 300_000,
  });
  const lastObservationQuery = useQuery<DataNodeLastObservation>({
    queryKey: ["main_sequence", "data_nodes", "snapshot", "last_observation", dataNodeId],
    queryFn: () => fetchDataNodeLastObservation(dataNodeId),
    enabled: dataNodeId > 0,
    staleTime: 300_000,
  });
  const snapshotAnchorMs = useMemo(
    () => resolveDataNodeWidgetPreviewAnchorMs(detailQuery.data, lastObservationQuery.data),
    [detailQuery.data, lastObservationQuery.data],
  );
  const snapshotColumns = useMemo(
    () => getSnapshotColumns(detailQuery.data, lastObservationQuery.data),
    [detailQuery.data, lastObservationQuery.data],
  );
  const snapshotQuery = useQuery({
    queryKey: [
      "main_sequence",
      "data_nodes",
      "snapshot",
      dataNodeId,
      snapshotAnchorMs,
      snapshotColumns.join("|"),
      snapshotRowLimit,
    ],
    queryFn: () =>
      fetchDataNodeDataBetweenDatesFromRemote(dataNodeId, {
        start_date: Math.floor(snapshotAnchorMs! / 1000),
        end_date: Math.floor(snapshotAnchorMs! / 1000),
        columns: snapshotColumns,
        great_or_equal: true,
        less_or_equal: true,
        limit: snapshotRowLimit,
        offset: 0,
      }),
    enabled:
      dataNodeId > 0 &&
      detailQuery.data?.sourcetableconfiguration != null &&
      snapshotAnchorMs != null &&
      snapshotColumns.length > 0,
    staleTime: 60_000,
  });
  const filteredRows = useMemo(() => {
    const rows = snapshotQuery.data ?? [];
    const needle = deferredFilterValue.trim().toLowerCase();

    if (!needle) {
      return rows;
    }

    return rows.filter((row) => buildSnapshotSearchText(row, snapshotColumns).includes(needle));
  }, [deferredFilterValue, snapshotColumns, snapshotQuery.data]);
  const isLoading =
    detailQuery.isLoading ||
    lastObservationQuery.isLoading ||
    (snapshotQuery.isLoading && snapshotQuery.fetchStatus !== "idle");

  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-base">Data Snapshot</CardTitle>
            <CardDescription>
              Preview the latest rows returned by this data node.
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
        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading data snapshot
            </div>
          </div>
        ) : null}

        {detailQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(detailQuery.error)}
          </div>
        ) : null}

        {!detailQuery.isError && snapshotQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(snapshotQuery.error)}
          </div>
        ) : null}

        {!isLoading && !detailQuery.isError && !snapshotQuery.isError ? (
          detailQuery.data?.sourcetableconfiguration == null ? (
            <DataNodePreviewTable
              columns={[]}
              rows={[]}
              maxRows={snapshotRowLimit}
              emptyMessage="No source-table configuration is available for this data node."
            />
          ) : snapshotAnchorMs == null ? (
            <DataNodePreviewTable
              columns={[]}
              rows={[]}
              maxRows={snapshotRowLimit}
              emptyMessage="No latest snapshot timestamp is available for this data node."
            />
          ) : snapshotColumns.length === 0 ? (
            <DataNodePreviewTable
              columns={[]}
              rows={[]}
              maxRows={snapshotRowLimit}
              emptyMessage="No snapshot columns could be resolved for this data node."
            />
          ) : (
            <DataNodePreviewTable
              columns={snapshotColumns}
              rows={filteredRows}
              maxRows={snapshotRowLimit}
              emptyMessage="No snapshot rows are available for this data node."
            />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
