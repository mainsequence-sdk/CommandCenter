import { useEffect, useMemo, useState } from "react";

import { Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import type {
  AnyConnectionTypeDefinition,
  ConnectionExploreProps,
  ConnectionQueryModel,
} from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

import {
  filterMassiveQueryModelsForConfig,
  formatMassiveAssetClassLabel,
  getEnabledMassiveAssetClasses,
} from "./massiveShared";

function buildDefaultFixedRange() {
  const fixedEndMs = Date.now();
  const fixedStartMs = fixedEndMs - 30 * 24 * 60 * 60 * 1000;

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
      kind: defaultQueryModel?.id ?? "massive-stocks-custom-bars",
    },
    timeRangeMode: defaultQueryModel?.timeRangeAware ? "fixed" : "none",
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
    maxRows: 1000,
  };
}

export function MassiveConnectionExplore({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const queryModels = useMemo(
    () => filterMassiveQueryModelsForConfig(connectionType.queryModels, connectionInstance.publicConfig),
    [connectionInstance.publicConfig, connectionType.queryModels],
  );
  const filteredConnectionType = useMemo<AnyConnectionTypeDefinition>(
    () => ({
      ...connectionType,
      queryModels,
    }),
    [connectionType, queryModels],
  );
  const defaultQueryModel =
    queryModels.find((model) => model.id === "massive-stocks-custom-bars") ?? queryModels[0];
  const defaultRange = useMemo(buildDefaultFixedRange, [connectionInstance.id]);
  const publicConfig = connectionInstance.publicConfig;
  const enabledAssetClasses = getEnabledMassiveAssetClasses(publicConfig);
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
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle>Massive Market Data Explore</CardTitle>
        </div>
        <CardDescription>
          Runs catalog-backed Massive REST requests through the backend adapter.
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
            {enabledAssetClasses.slice(0, 6).map((assetClass) => (
              <Badge key={assetClass} variant="neutral">
                {formatMassiveAssetClassLabel(assetClass)}
              </Badge>
            ))}
            {enabledAssetClasses.length > 6 ? (
              <Badge variant="neutral">+{enabledAssetClasses.length - 6}</Badge>
            ) : null}
            {publicConfig.enableBetaEndpoints === true ? <Badge variant="secondary">beta</Badge> : null}
            {publicConfig.enableDeprecatedEndpoints === true ? (
              <Badge variant="secondary">deprecated</Badge>
            ) : null}
            <Badge variant="neutral">cache {String(publicConfig.queryCachePolicy ?? "read")}</Badge>
          </div>
        </div>

        <ConnectionQueryWorkbench
          value={queryProps}
          onChange={setQueryProps}
          editable
          connectionInstance={connectionInstance}
          connectionType={filteredConnectionType}
          fixedRangeFallback={{
            rangeStartMs: defaultRange.fixedStartMs,
            rangeEndMs: defaultRange.fixedEndMs,
          }}
          showConnectionPicker={false}
          autoSelectFirstQueryModel
          runButtonLabel="Run market data query"
          resultTitle="Market data result"
          resultDescription="Preview of the normalized Massive tabular frame returned by the backend adapter."
        />
      </CardContent>
    </Card>
  );
}
