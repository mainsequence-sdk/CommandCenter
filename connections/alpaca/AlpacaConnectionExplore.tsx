import { useEffect, useMemo, useState } from "react";

import { LineChart } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import type { ConnectionExploreProps, ConnectionQueryModel } from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

function buildDefaultFixedRange() {
  const fixedEndMs = Date.now();
  const fixedStartMs = fixedEndMs - 24 * 60 * 60 * 1000;

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
      kind: defaultQueryModel?.id ?? "alpaca-equity-ohlc",
    },
    timeRangeMode: defaultQueryModel?.timeRangeAware ? "fixed" : "none",
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
    maxRows: 1000,
  };
}

export function AlpacaConnectionExplore({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const queryModels = useMemo(() => connectionType.queryModels ?? [], [connectionType.queryModels]);
  const defaultQueryModel =
    queryModels.find((model) => model.id === "alpaca-equity-ohlc") ?? queryModels[0];
  const defaultRange = useMemo(buildDefaultFixedRange, [connectionInstance.id]);
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
          <LineChart className="h-5 w-5 text-primary" />
          <CardTitle>Alpaca Market Data Explore</CardTitle>
        </div>
        <CardDescription>
          Runs equities and crypto market-data requests through the backend Alpaca adapter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Data source</div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">
            {connectionInstance.name}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {connectionInstance.id}
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
          runButtonLabel="Run market data query"
          resultTitle="Market data result"
          resultDescription="Preview of the normalized Alpaca tabular frame returned by the backend adapter."
        />
      </CardContent>
    </Card>
  );
}
