import { Database } from "lucide-react";

import { getConnectionTypeById } from "@/app/registry";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} from "@/widgets/shared/tabular-frame-source";
import {
  TIMESERIES_FRAME_SOURCE_CONTRACTS,
  TIMESERIES_FRAME_SOURCE_VALUE_DESCRIPTOR,
  normalizeTimeSeriesFrameSource,
} from "@/widgets/shared/timeseries-frame-source";
import { defineWidget, type WidgetIoDefinition } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { ConnectionQueryWidget } from "./ConnectionQueryWidget";
import { ConnectionQueryWidgetSettings } from "./ConnectionQueryWidgetSettings";
import {
  buildConnectionQueryErrorFrame,
  executeConnectionQueryWidgetRequest,
  normalizeConnectionQueryProps,
  normalizeConnectionQueryRuntimeState,
  type ConnectionQueryWidgetProps,
} from "./connectionQueryModel";

export const CONNECTION_QUERY_DATASET_OUTPUT_ID = "dataset";

function resolveConfiguredOutputContract(props: ConnectionQueryWidgetProps) {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;
  const queryModel = connectionType?.queryModels?.find(
    (model) => model.id === normalizedProps.queryModelId,
  );
  const advertisedContracts = queryModel?.outputContracts ?? [];

  return advertisedContracts.find((contract) =>
    TIMESERIES_FRAME_SOURCE_CONTRACTS.includes(
      contract as (typeof TIMESERIES_FRAME_SOURCE_CONTRACTS)[number],
    ),
  ) ?? CORE_TABULAR_FRAME_SOURCE_CONTRACT;
}

function resolveConnectionQueryIo(
  props: ConnectionQueryWidgetProps,
  runtimeState?: Record<string, unknown>,
): WidgetIoDefinition<ConnectionQueryWidgetProps> {
  const runtimeTimeSeries = normalizeTimeSeriesFrameSource(runtimeState);
  const outputContract = runtimeTimeSeries?.contract ?? resolveConfiguredOutputContract(props);
  const publishesTimeSeries = TIMESERIES_FRAME_SOURCE_CONTRACTS.includes(
    outputContract as (typeof TIMESERIES_FRAME_SOURCE_CONTRACTS)[number],
  );

  return {
    outputs: [
      {
        id: CONNECTION_QUERY_DATASET_OUTPUT_ID,
        label: "Dataset",
        contract: outputContract,
        description: publishesTimeSeries
          ? "Publishes the selected connection response frame as a time-series dataset."
          : "Publishes the selected connection response frame as a tabular dataset.",
        valueDescriptor: publishesTimeSeries
          ? TIMESERIES_FRAME_SOURCE_VALUE_DESCRIPTOR
          : TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: ({ runtimeState: resolvedRuntimeState }) => {
          const timeSeriesFrame = normalizeTimeSeriesFrameSource(resolvedRuntimeState);

          if (timeSeriesFrame) {
            return timeSeriesFrame;
          }

          const publishedFrame = normalizeConnectionQueryRuntimeState(resolvedRuntimeState);

          if (publishedFrame) {
            return publishedFrame;
          }

          return publishesTimeSeries ? undefined : {
            status: "idle",
            columns: [],
            rows: [],
          };
        },
      },
    ],
  };
}

export const connectionQueryWidget = defineWidget<ConnectionQueryWidgetProps>({
  id: "connection-query",
  widgetVersion: "1.1.0",
  title: "Connection Query",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["connection", "query", "source", "tabular", "time-series", "data-source"],
  exampleProps: {
    query: {},
    timeRangeMode: "dashboard",
    selectedFrame: 0,
  },
  mockProps: {
    queryModelId: "example-query",
    query: {
      kind: "example-query",
    },
    timeRangeMode: "dashboard",
    selectedFrame: 0,
  },
  mockRuntimeState: {
    status: "ready",
    columns: ["timestamp", "value"],
    rows: [
      { timestamp: "2026-04-25T10:00:00.000Z", value: 42 },
      { timestamp: "2026-04-25T11:00:00.000Z", value: 45 },
    ],
    fields: [
      { key: "timestamp", type: "datetime", provenance: "backend" },
      { key: "value", type: "number", provenance: "backend" },
    ],
    source: {
      kind: "connection-query",
      label: "Example query",
    },
  },
  workspaceIcon: Database,
  defaultPresentation: {
    placementMode: "sidebar",
  },
  fixedPlacementMode: "sidebar",
  workspaceRuntimeMode: "execution-owner",
  io: resolveConnectionQueryIo({}),
  resolveIo: ({ props, runtimeState }) => resolveConnectionQueryIo(props, runtimeState),
  execution: {
    canExecute: (context) => {
      const props = normalizeConnectionQueryProps(context.targetOverrides?.props ?? context.props);
      return Boolean(props.connectionRef?.uid && props.queryModelId);
    },
    execute: async (context) => {
      const props = normalizeConnectionQueryProps(
        (context.targetOverrides?.props ?? context.props) as ConnectionQueryWidgetProps,
      );

      try {
        const runtimeStatePatch = await executeConnectionQueryWidgetRequest(
          props,
          context.dashboardState,
        );

        return {
          status: "success",
          runtimeStatePatch: runtimeStatePatch as unknown as Record<string, unknown>,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Connection query failed.";

        return {
          status: "error",
          error: errorMessage,
          runtimeStatePatch: buildConnectionQueryErrorFrame(
            errorMessage,
            props,
          ) as unknown as Record<string, unknown>,
        };
      }
    },
    getRefreshPolicy: (context) => {
      const props = normalizeConnectionQueryProps(context.targetOverrides?.props ?? context.props);
      return props.connectionRef?.uid && props.queryModelId ? "allow-refresh" : "manual-only";
    },
    getExecutionKey: (context) => `connection-query:${context.instanceId}`,
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Selects a backend-owned connection instance, query model, query payload, range behavior, variables, and selected response frame.",
      requiredSetupSteps: [
        "Select a configured connection instance.",
        "Choose a query model exposed by the connection type.",
        "Configure the query payload and runtime range behavior.",
        "Bind downstream widgets to the dataset output.",
      ],
      configurationNotes: [
        "The widget stores a stable ConnectionRef and query config, not credentials or endpoint URLs.",
        "Connection-specific query editors are used when the connection type provides one.",
        "The widget is fixed to sidebar placement because it is a source/execution node, not a canvas presentation widget.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate", "upstream-update"],
      executionSummary:
        "Calls the selected connection query through the shared connection API and publishes the selected response frame as a tabular or time-series dataset.",
    },
    io: {
      mode: "dynamic",
      summary: "Publishes one canonical tabular or time-series dataset from a connection query response.",
      dynamicIoSummary:
        "The selected query model controls whether the dataset output advertises a time-series or tabular contract.",
      outputContracts: [...TIMESERIES_FRAME_SOURCE_CONTRACTS, CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    },
    capabilities: {
      publishesContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      publishedContracts: [...TIMESERIES_FRAME_SOURCE_CONTRACTS, CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      fixedPlacementMode: "sidebar",
      supportsConnectionQueryModels: true,
      supportsDashboardTimeRange: true,
      supportsFixedTimeRange: true,
      supportsVariables: true,
      supportsSelectedFrame: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "Tabular connection source",
        summary: "Runs one connection query and publishes rows for downstream widgets.",
        props: {
          timeRangeMode: "dashboard",
          selectedFrame: 0,
        },
      },
    ],
  },
  settingsComponent: ConnectionQueryWidgetSettings,
  component: ConnectionQueryWidget,
});
