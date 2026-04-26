import { useEffect, useMemo, useState } from "react";

import { Database } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import type { ConnectionExploreProps, ConnectionQueryModel } from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultQueryForModel(queryModelId: string | undefined): Record<string, unknown> {
  return { kind: queryModelId ?? "sql", sql: "" };
}

function buildDefaultQueryProps(input: {
  connectionInstance: ConnectionExploreProps["connectionInstance"];
  defaultQueryModel: ConnectionQueryModel | undefined;
}): ConnectionQueryWidgetProps {
  const { connectionInstance, defaultQueryModel } = input;

  return {
    connectionRef: {
      id: connectionInstance.id,
      typeId: connectionInstance.typeId,
    },
    queryModelId: defaultQueryModel?.id,
    query: defaultQueryForModel(defaultQueryModel?.id),
    timeRangeMode: "none",
  };
}

export function PostgreSqlConnectionExplore({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const queryModels = useMemo(() => connectionType.queryModels ?? [], [connectionType.queryModels]);
  const defaultQueryModel = queryModels[0];
  const queryCachePolicy = readConfigString(
    connectionInstance.publicConfig,
    "queryCachePolicy",
    "safe",
  );
  const queryCacheTtlMs = readConfigNumber(
    connectionInstance.publicConfig,
    "queryCacheTtlMs",
    300000,
  );
  const metadataCacheTtlMs = readConfigNumber(
    connectionInstance.publicConfig,
    "metadataCacheTtlMs",
    300000,
  );
  const statementTimeoutMs = readConfigNumber(
    connectionInstance.publicConfig,
    "statementTimeoutMs",
    30000,
  );
  const dedupeInFlight = connectionInstance.publicConfig.dedupeInFlight !== false;
  const [queryProps, setQueryProps] = useState<ConnectionQueryWidgetProps>(() =>
    buildDefaultQueryProps({
      connectionInstance,
      defaultQueryModel,
    }),
  );

  useEffect(() => {
    setQueryProps(
      buildDefaultQueryProps({
        connectionInstance,
        defaultQueryModel,
      }),
    );
  }, [
    connectionInstance.typeId,
    connectionInstance.id,
    defaultQueryModel?.id,
  ]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>PostgreSQL Explore</CardTitle>
        </div>
        <CardDescription>
          Runs the same generated connection query request as the workspace Connection Query widget.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_180px]">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
            <div className="text-xs font-medium text-muted-foreground">Data source</div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">
              {connectionInstance.name}
            </div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {connectionInstance.id}
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
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            Statement timeout: {statementTimeoutMs.toLocaleString()} ms.
            <br />
            Metadata cache: {metadataCacheTtlMs.toLocaleString()} ms.
          </div>
        </div>

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
  );
}
