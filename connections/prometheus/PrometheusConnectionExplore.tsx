import { useEffect, useMemo, useState } from "react";

import { Search } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import type { ConnectionExploreProps } from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

import {
  buildPrometheusDefaultQueryProps,
  PrometheusConnectionSourceSummary,
} from "./prometheusAuthoring";

export function PrometheusConnectionExplore({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const queryModels = useMemo(() => connectionType.queryModels ?? [], [connectionType.queryModels]);
  const defaultQueryModel =
    queryModels.find((model) => model.id === "promql-range") ?? queryModels[0];
  const [queryProps, setQueryProps] = useState<ConnectionQueryWidgetProps>(() =>
    buildPrometheusDefaultQueryProps({
      connectionInstance,
      connectionType,
      queryModels,
      selectedQueryModel: defaultQueryModel,
    }),
  );

  useEffect(() => {
    setQueryProps(
      buildPrometheusDefaultQueryProps({
        connectionInstance,
        connectionType,
        queryModels,
        selectedQueryModel: defaultQueryModel,
      }),
    );
  }, [
    connectionInstance.id,
    connectionInstance.typeId,
    connectionType,
    defaultQueryModel,
    queryModels,
  ]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <CardTitle>Prometheus Explore</CardTitle>
        </div>
        <CardDescription>
          Runs the same generated connection query request and PromQL authoring surface used by
          workspace connection-query widgets and managed widget-owned sources.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <PrometheusConnectionSourceSummary
          connectionInstance={connectionInstance}
          connectionType={connectionType}
        />

        <ConnectionQueryWorkbench
          value={queryProps}
          onChange={setQueryProps}
          editable
          connectionInstance={connectionInstance}
          connectionType={connectionType}
          fixedRangeFallback={{
            rangeStartMs: queryProps.fixedStartMs ?? Date.now() - 60 * 60 * 1000,
            rangeEndMs: queryProps.fixedEndMs ?? Date.now(),
          }}
          showConnectionPicker={false}
          showQueryEditor
          autoSelectFirstQueryModel
          runButtonLabel="Run query"
          resultDescription="Preview of the normalized connection runtime frame."
        />
      </CardContent>
    </Card>
  );
}
