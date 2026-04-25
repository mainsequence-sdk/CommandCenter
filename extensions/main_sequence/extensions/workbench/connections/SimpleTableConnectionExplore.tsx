import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import type { ConnectionExploreProps, ConnectionQueryModel } from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

import { fetchSimpleTableDetail } from "../../../common/api";
import {
  DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS,
  DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
  type MainSequenceSimpleTableConnectionPublicConfig,
} from "./simpleTableConnection";

function readConfigString(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readConfigNumber(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  const value = config[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function readConfiguredSimpleTableId(config: Record<string, unknown>) {
  const parsed = Number(config.simpleTableId);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function getSimpleTableColumnNames(
  detail: Awaited<ReturnType<typeof fetchSimpleTableDetail>> | undefined,
) {
  if (!detail) {
    return [];
  }

  if (Array.isArray(detail.columns) && detail.columns.length > 0) {
    return detail.columns.map((column) => column.column_name).filter(Boolean);
  }

  const metadata = detail.sourcetableconfiguration?.columns_metadata;

  if (!Array.isArray(metadata)) {
    return [];
  }

  return metadata.flatMap((column) =>
    typeof column.column_name === "string" && column.column_name.trim()
      ? [column.column_name]
      : [],
  );
}

function buildDefaultQueryProps(input: {
  connectionInstance: ConnectionExploreProps["connectionInstance"];
  defaultMaxRows: number;
  defaultQueryModel: ConnectionQueryModel | undefined;
}): ConnectionQueryWidgetProps {
  const { connectionInstance, defaultMaxRows, defaultQueryModel } = input;

  return {
    connectionRef: {
      uid: connectionInstance.uid,
      typeId: connectionInstance.typeId,
    },
    queryModelId: defaultQueryModel?.id,
    query: defaultQueryModel
      ? {
          kind: defaultQueryModel.id,
          sql: "select *\nfrom {{simple_table}}\nlimit 100",
        }
      : {},
    timeRangeMode: "none",
    maxRows: defaultMaxRows,
  };
}

export function SimpleTableConnectionExplore({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const publicConfig =
    connectionInstance.publicConfig as MainSequenceSimpleTableConnectionPublicConfig &
      Record<string, unknown>;
  const simpleTableId = readConfiguredSimpleTableId(publicConfig);
  const simpleTableLabel = readConfigString(
    publicConfig,
    "simpleTableLabel",
    simpleTableId ? `Simple Table ${simpleTableId}` : "No Simple Table configured",
  );
  const defaultMaxRows = readConfigNumber(
    publicConfig,
    "defaultLimit",
    DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_ROW_LIMIT,
  );
  const queryCachePolicy = readConfigString(publicConfig, "queryCachePolicy", "safe");
  const queryCacheTtlMs = readConfigNumber(
    publicConfig,
    "queryCacheTtlMs",
    DEFAULT_MAIN_SEQUENCE_SIMPLE_TABLE_QUERY_CACHE_TTL_MS,
  );
  const dedupeInFlight = publicConfig.dedupeInFlight !== false;
  const queryModels = useMemo(() => connectionType.queryModels ?? [], [connectionType.queryModels]);
  const defaultQueryModel = queryModels[0];
  const [queryProps, setQueryProps] = useState<ConnectionQueryWidgetProps>(() =>
    buildDefaultQueryProps({
      connectionInstance,
      defaultMaxRows,
      defaultQueryModel,
    }),
  );

  useEffect(() => {
    setQueryProps(
      buildDefaultQueryProps({
        connectionInstance,
        defaultMaxRows,
        defaultQueryModel,
      }),
    );
  }, [
    connectionInstance.typeId,
    connectionInstance.uid,
    defaultMaxRows,
    defaultQueryModel?.id,
    defaultQueryModel?.timeRangeAware,
  ]);

  const simpleTableDetailQuery = useQuery({
    queryKey: ["main_sequence", "connections", "simple_table", "explore", simpleTableId],
    queryFn: () => fetchSimpleTableDetail(simpleTableId!),
    enabled: Boolean(simpleTableId),
    staleTime: 300_000,
  });
  const columns = getSimpleTableColumnNames(simpleTableDetailQuery.data);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Simple Table SQL Explore</CardTitle>
          </div>
          <CardDescription>
            Runs the same generated connection query request as the workspace Connection Query
            widget.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_180px]">
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">Simple Table</div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">
                {simpleTableLabel}
              </div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {simpleTableId ? `id ${simpleTableId}` : "not configured"}
              </div>
            </div>
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">Query policy</div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">
                {queryCachePolicy === "disabled"
                  ? "Cache disabled"
                  : `${queryCacheTtlMs.toLocaleString()} ms cache`}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {dedupeInFlight ? "in-flight dedupe enabled" : "in-flight dedupe disabled"}
              </div>
            </div>
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">Default rows</div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">
                {defaultMaxRows.toLocaleString()}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                The request maxRows can override this draft value.
              </div>
            </div>
          </div>

          {simpleTableDetailQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              Unable to load Simple Table detail metadata.
            </div>
          ) : null}

          {columns.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {columns.slice(0, 16).map((columnName) => (
                <Badge key={columnName} variant="neutral" className="normal-case">
                  {columnName}
                </Badge>
              ))}
              {columns.length > 16 ? (
                <Badge variant="neutral">+{columns.length - 16} columns</Badge>
              ) : null}
            </div>
          ) : null}

          <ConnectionQueryWorkbench
            value={queryProps}
            onChange={setQueryProps}
            editable
            connectionInstance={connectionInstance}
            connectionType={connectionType}
            showConnectionPicker={false}
            autoSelectFirstQueryModel
            runButtonLabel="Run query"
            resultDescription="Preview of the normalized connection runtime frame."
          />
        </CardContent>
      </Card>
    </div>
  );
}
