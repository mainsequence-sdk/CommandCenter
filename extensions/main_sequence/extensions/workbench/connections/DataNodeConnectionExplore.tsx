import { useMemo, useState } from "react";

import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ConnectionExploreProps } from "@/connections/types";
import type { DataNodeRemoteDataRow } from "../../../common/api";

import { DataNodePreviewTable } from "../widgets/data-node-shared/DataNodePreviewTable";
import { DataNodeQuickSearchPicker } from "../widgets/data-node-shared/DataNodeQuickSearchPicker";
import { formatDataNodeLabel } from "../widgets/data-node-shared/dataNodeShared";
import {
  type MainSequenceDataNodeConnectionPublicConfig,
  queryMainSequenceDataNodeDetail,
  queryMainSequenceDataNodeLastObservation,
  queryMainSequenceDataNodeRowsBetweenDates,
} from "./dataNodeConnection";

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function currentUnixSeconds(offsetMs = 0) {
  return Math.floor((Date.now() + offsetMs) / 1000);
}

function resolveColumns(rows: DataNodeRemoteDataRow[] | undefined) {
  return Array.from(new Set((rows ?? []).flatMap((row) => Object.keys(row))));
}

export function DataNodeConnectionExplore({
  connectionInstance,
}: ConnectionExploreProps) {
  const config = connectionInstance.publicConfig as MainSequenceDataNodeConnectionPublicConfig;
  const [dataNodeId, setDataNodeId] = useState(config.dataNodeId);
  const [columnsText, setColumnsText] = useState("unique_identifier,value,asof");
  const [startDate, setStartDate] = useState(String(currentUnixSeconds(-24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(String(currentUnixSeconds()));
  const selectedDataNode = useMemo(
    () =>
      dataNodeId
        ? {
            id: dataNodeId,
            identifier: config.dataNodeLabel ?? null,
            storage_hash: config.dataNodeStorageHash ?? "",
          }
        : null,
    [config.dataNodeLabel, config.dataNodeStorageHash, dataNodeId],
  );
  const connectionRef = {
    uid: connectionInstance.uid,
    typeId: connectionInstance.typeId,
  };

  const detailMutation = useMutation({
    mutationFn: () => queryMainSequenceDataNodeDetail(dataNodeId, connectionRef),
  });
  const rowsMutation = useMutation({
    mutationFn: () => {
      const resolvedStart = Number(startDate);
      const resolvedEnd = Number(endDate);
      const columns = columnsText
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean);

      if (!Number.isFinite(resolvedStart) || !Number.isFinite(resolvedEnd)) {
        throw new Error("Start and end dates must be Unix seconds.");
      }

      if (columns.length === 0) {
        throw new Error("At least one column is required.");
      }

      return queryMainSequenceDataNodeRowsBetweenDates(
        dataNodeId,
        {
          start_date: Math.trunc(resolvedStart),
          end_date: Math.trunc(resolvedEnd),
          columns,
          limit: config.defaultLimit,
        },
        connectionRef,
      );
    },
  });
  const lastObservationMutation = useMutation({
    mutationFn: () => queryMainSequenceDataNodeLastObservation(dataNodeId, connectionRef),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,440px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Explore Data Node</CardTitle>
          <CardDescription>
            Run direct Data Node reads through this configured connection instance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <DataNodeQuickSearchPicker
            value={dataNodeId}
            onChange={setDataNodeId}
            onSelectedDataNodeChange={(dataNode) => {
              setDataNodeId(dataNode?.id);
            }}
            editable
            queryScope="data_node_connection_explore"
            selectedDataNode={selectedDataNode}
            selectionHelpText="Choose a Data Node to test with this connection."
          />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Start Unix seconds</span>
              <Input value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">End Unix seconds</span>
              <Input value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Columns</span>
            <Input
              value={columnsText}
              onChange={(event) => setColumnsText(event.target.value)}
              placeholder="comma,separated,columns"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!normalizePositiveInteger(dataNodeId) || detailMutation.isPending}
              onClick={() => detailMutation.mutate()}
            >
              Load detail
            </Button>
            <Button
              type="button"
              disabled={!normalizePositiveInteger(dataNodeId) || rowsMutation.isPending}
              onClick={() => rowsMutation.mutate()}
            >
              Load rows
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!normalizePositiveInteger(dataNodeId) || lastObservationMutation.isPending}
              onClick={() => lastObservationMutation.mutate()}
            >
              Load latest
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>Connection response preview.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rowsMutation.data ? (
            <DataNodePreviewTable columns={resolveColumns(rowsMutation.data)} rows={rowsMutation.data} />
          ) : null}
          {lastObservationMutation.data ? (
            <DataNodePreviewTable
              columns={resolveColumns([lastObservationMutation.data])}
              rows={[lastObservationMutation.data]}
            />
          ) : null}
          {detailMutation.data ? (
            <pre className="max-h-[520px] overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50 p-4 font-mono text-xs leading-6 text-foreground">
              <code>{JSON.stringify(detailMutation.data, null, 2)}</code>
            </pre>
          ) : null}
          {detailMutation.error || rowsMutation.error || lastObservationMutation.error ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {String(
                (detailMutation.error ?? rowsMutation.error ?? lastObservationMutation.error) instanceof Error
                  ? (detailMutation.error ?? rowsMutation.error ?? lastObservationMutation.error)?.message
                  : detailMutation.error ?? rowsMutation.error ?? lastObservationMutation.error,
              )}
            </div>
          ) : null}
          {!detailMutation.data && !rowsMutation.data && !lastObservationMutation.data ? (
            <div className="text-sm text-muted-foreground">Run a query to see the response.</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
