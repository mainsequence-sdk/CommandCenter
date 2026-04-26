import { useEffect, useMemo, useState } from "react";

import { Database } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import type { ConnectionExploreProps, ConnectionQueryModel } from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

import {
  DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT,
  type MainSequenceDataNodeConnectionPublicConfig,
} from "./dataNodeConnection";

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function buildDefaultFixedRange() {
  const fixedEndMs = Date.now();
  const fixedStartMs = fixedEndMs - 24 * 60 * 60 * 1000;

  return { fixedStartMs, fixedEndMs };
}

function buildDefaultQueryProps(input: {
  connectionInstance: ConnectionExploreProps["connectionInstance"];
  defaultLimit: number;
  defaultQueryModel: ConnectionQueryModel | undefined;
  defaultRange: ReturnType<typeof buildDefaultFixedRange>;
}): ConnectionQueryWidgetProps {
  const { connectionInstance, defaultLimit, defaultQueryModel, defaultRange } = input;

  return {
    connectionRef: {
      id: connectionInstance.id,
      typeId: connectionInstance.typeId,
    },
    queryModelId: defaultQueryModel?.id,
    query: defaultQueryModel ? { kind: defaultQueryModel.id } : {},
    timeRangeMode: defaultQueryModel?.timeRangeAware ? "fixed" : "none",
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
    maxRows: defaultLimit,
  };
}

export function DataNodeConnectionExplore({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const queryModels = useMemo(() => connectionType.queryModels ?? [], [connectionType.queryModels]);
  const defaultQueryModel = queryModels[0];
  const config = connectionInstance.publicConfig as MainSequenceDataNodeConnectionPublicConfig;
  const defaultRange = useMemo(() => buildDefaultFixedRange(), [connectionInstance.id]);
  const defaultLimit =
    normalizePositiveInteger(config.defaultLimit) ?? DEFAULT_MAIN_SEQUENCE_DATA_NODE_ROW_LIMIT;
  const [queryProps, setQueryProps] = useState<ConnectionQueryWidgetProps>(() =>
    buildDefaultQueryProps({
      connectionInstance,
      defaultLimit,
      defaultQueryModel,
      defaultRange,
    }),
  );

  useEffect(() => {
    setQueryProps(
      buildDefaultQueryProps({
        connectionInstance,
        defaultLimit,
        defaultQueryModel,
        defaultRange,
      }),
    );
  }, [
    connectionInstance.typeId,
    connectionInstance.id,
    defaultLimit,
    defaultQueryModel?.id,
    defaultQueryModel?.timeRangeAware,
    defaultRange.fixedEndMs,
    defaultRange.fixedStartMs,
  ]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>Data Node Query Explore</CardTitle>
        </div>
        <CardDescription>
          Runs the same generated connection query request as the workspace Connection Query widget.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
          runButtonLabel="Run query"
          resultDescription="Preview of the normalized widget runtime frame."
        />
      </CardContent>
    </Card>
  );
}
