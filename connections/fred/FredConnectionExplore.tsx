import { useEffect, useMemo, useState } from "react";

import { Landmark } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import type { ConnectionExploreProps, ConnectionQueryModel } from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

function buildDefaultFixedRange() {
  const fixedEndMs = Date.now();
  const fixedStartMs = fixedEndMs - 5 * 365 * 24 * 60 * 60 * 1000;

  return { fixedStartMs, fixedEndMs };
}

function buildDefaultQueryProps(input: {
  connectionInstance: ConnectionExploreProps["connectionInstance"];
  defaultQueryModel: ConnectionQueryModel | undefined;
  defaultRange: ReturnType<typeof buildDefaultFixedRange>;
}): ConnectionQueryWidgetProps {
  const { connectionInstance, defaultQueryModel, defaultRange } = input;

  return {
    connectionRef: {
      id: connectionInstance.id,
      typeId: connectionInstance.typeId,
    },
    queryModelId: defaultQueryModel?.id,
    query: {
      ...(defaultQueryModel?.defaultQuery ?? {}),
      kind: defaultQueryModel?.id ?? "fred-series-observations",
    },
    timeRangeMode: defaultQueryModel?.timeRangeAware ? "fixed" : "none",
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
    maxRows: 1000,
  };
}

export function FredConnectionExplore({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const queryModels = useMemo(() => connectionType.queryModels ?? [], [connectionType.queryModels]);
  const defaultQueryModel =
    queryModels.find((model) => model.id === "fred-series-observations") ?? queryModels[0];
  const defaultRange = useMemo(buildDefaultFixedRange, [connectionInstance.id]);
  const publicConfig = connectionInstance.publicConfig;
  const [queryProps, setQueryProps] = useState<ConnectionQueryWidgetProps>(() =>
    buildDefaultQueryProps({ connectionInstance, defaultQueryModel, defaultRange }),
  );

  useEffect(() => {
    setQueryProps(buildDefaultQueryProps({ connectionInstance, defaultQueryModel, defaultRange }));
  }, [
    connectionInstance.typeId,
    connectionInstance.id,
    defaultQueryModel?.id,
    defaultQueryModel?.timeRangeAware,
    defaultRange.fixedEndMs,
    defaultRange.fixedStartMs,
  ]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <CardTitle>FRED Economic Data Explore</CardTitle>
        </div>
        <CardDescription>
          Runs macroeconomic and regional time-series requests through the backend FRED adapter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
            <div className="text-xs font-medium text-muted-foreground">Data source</div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">
              {connectionInstance.name}
            </div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {connectionInstance.id}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{String(publicConfig.defaultSeriesId ?? "GDP")}</Badge>
            <Badge variant="neutral">{String(publicConfig.defaultUnits ?? "lin")}</Badge>
            <Badge variant="neutral">
              {String(publicConfig.defaultFrequency ?? "native frequency")}
            </Badge>
            <Badge variant="neutral">limit {String(publicConfig.defaultLimit ?? 1000)}</Badge>
            <Badge variant="neutral">cache {String(publicConfig.queryCachePolicy ?? "read")}</Badge>
            {publicConfig.dedupeInFlight !== false ? <Badge variant="neutral">dedupe</Badge> : null}
          </div>
        </div>

        <ConnectionQueryWorkbench
          value={queryProps}
          onChange={setQueryProps}
          editable
          connectionInstance={connectionInstance}
          connectionType={connectionType}
          fixedRangeFallback={{
            rangeStartMs: defaultRange.fixedStartMs,
            rangeEndMs: defaultRange.fixedEndMs,
          }}
          showConnectionPicker={false}
          autoSelectFirstQueryModel
          runButtonLabel="Run FRED query"
          resultTitle="Economic data result"
          resultDescription="Preview of the normalized FRED tabular frame returned by the backend adapter."
        />
      </CardContent>
    </Card>
  );
}
