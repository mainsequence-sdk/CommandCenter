import { useMemo, useRef } from "react";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  JsonTreeViewer,
  type JsonTreeViewerHandle,
} from "@/components/ui/json-tree-viewer";

import {
  fetchDataNodeStats,
  formatMainSequenceError,
} from "../../../../common/api";

const emptyStatsPayload = {
  multi_index_stats: {},
  multi_index_column_stats: {},
};

function countObjectKeys(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;
}

export function MainSequenceDataNodeStatsTab({
  dataNodeUid,
}: {
  dataNodeUid: string;
}) {
  const jsonViewerRef = useRef<JsonTreeViewerHandle | null>(null);
  const statsQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "stats", dataNodeUid],
    queryFn: () => fetchDataNodeStats(dataNodeUid),
    enabled: Boolean(String(dataNodeUid).trim()),
  });
  const statsPayload = useMemo(
    () => statsQuery.data ?? emptyStatsPayload,
    [statsQuery.data],
  );
  const multiIndexStatsKeyCount = countObjectKeys(statsQuery.data?.multi_index_stats);
  const multiIndexColumnStatsKeyCount = countObjectKeys(statsQuery.data?.multi_index_column_stats);

  return (
    <Card variant="nested">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Stats
            </CardTitle>
            <CardDescription>
              Dynamic table stats returned by the DataNode get-stats endpoint.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`${multiIndexStatsKeyCount} stats keys`}</Badge>
            <Badge variant="neutral">{`${multiIndexColumnStatsKeyCount} column stats keys`}</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => jsonViewerRef.current?.collapseAll()}
              disabled={statsQuery.isLoading || statsQuery.isError}
            >
              Collapse all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => jsonViewerRef.current?.expandAll()}
              disabled={statsQuery.isLoading || statsQuery.isError}
            >
              Expand all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void statsQuery.refetch();
              }}
              disabled={statsQuery.isFetching}
            >
              {statsQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {statsQuery.isLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading data node stats
            </div>
          </div>
        ) : null}

        {statsQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(statsQuery.error)}
          </div>
        ) : null}

        {!statsQuery.isLoading && !statsQuery.isError ? (
          <div
            className="overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50"
            data-no-widget-drag="true"
          >
            <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 px-3 py-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
                JSON
              </span>
              <span className="max-w-full truncate font-mono text-[11px] text-muted-foreground sm:max-w-[min(520px,50vw)]">
                /orm/api/ts_manager/dynamic_table/{dataNodeUid}/get-stats/
              </span>
            </div>
            <JsonTreeViewer
              ref={jsonViewerRef}
              ariaLabel="Data node stats JSON"
              className="min-h-[440px]"
              defaultExpandedDepth={1}
              value={statsPayload}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
