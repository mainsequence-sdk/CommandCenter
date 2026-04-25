import { Database } from "lucide-react";

import { getConnectionTypeById } from "@/app/registry";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} from "@/widgets/shared/tabular-frame-source";
import { defineWidget, type WidgetIoDefinition } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { ConnectionQueryWidget } from "./ConnectionQueryWidget";
import { ConnectionQueryWidgetSettings } from "./ConnectionQueryWidgetSettings";
import {
  buildConnectionQueryErrorFrame,
  executeConnectionQueryWidgetRequest,
  normalizeConnectionQueryProps,
  normalizeConnectionQueryRuntimeState,
  resolveConnectionQueryRequestedOutputContract,
  type ConnectionQueryWidgetProps,
} from "./connectionQueryModel";

export const CONNECTION_QUERY_DATASET_OUTPUT_ID = "dataset";

function resolveConfiguredQueryModel(props: ConnectionQueryWidgetProps) {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;

  return connectionType?.queryModels?.find(
    (model) => model.id === normalizedProps.queryModelId,
  );
}

function resolveConfiguredOutputContract(props: ConnectionQueryWidgetProps) {
  const queryModel = resolveConfiguredQueryModel(props);
  const advertisedContracts = queryModel?.outputContracts ?? [];

  if (
    advertisedContracts.includes(CORE_TABULAR_FRAME_SOURCE_CONTRACT) ||
    advertisedContracts.includes(LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT)
  ) {
    return CORE_TABULAR_FRAME_SOURCE_CONTRACT;
  }

  const requestedOutputContract = resolveConnectionQueryRequestedOutputContract(queryModel);
  return requestedOutputContract ?? CORE_TABULAR_FRAME_SOURCE_CONTRACT;
}

function formatConnectionQueryOutputContract(contract: string) {
  if (contract === CORE_TABULAR_FRAME_SOURCE_CONTRACT) {
    return "Tabular";
  }

  return contract;
}

function resolveConnectionQueryIo(
  props: ConnectionQueryWidgetProps,
  runtimeState?: Record<string, unknown>,
): WidgetIoDefinition<ConnectionQueryWidgetProps> {
  const queryModel = resolveConfiguredQueryModel(props);
  const outputContract = resolveConfiguredOutputContract(props);
  const outputLabel = queryModel
    ? `${queryModel.label} (${formatConnectionQueryOutputContract(outputContract)})`
    : "Unconfigured dataset";

  return {
    outputs: [
      {
        id: CONNECTION_QUERY_DATASET_OUTPUT_ID,
        label: outputLabel,
        contract: outputContract,
        description:
          `Publishes the ${queryModel?.id ?? "selected"} connection path as one canonical tabular dataset.`,
        valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: ({ runtimeState: resolvedRuntimeState }) => {
          const publishedFrame = normalizeConnectionQueryRuntimeState(resolvedRuntimeState);

          if (publishedFrame) {
            return publishedFrame;
          }

          return {
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
  widgetVersion: "1.3.0",
  title: "Connection Query",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["connection", "query", "source", "tabular", "data-source"],
  exampleProps: {
    query: {},
    timeRangeMode: "dashboard",
  },
  mockProps: {
    queryModelId: "example-query",
    query: {
      kind: "example-query",
    },
    timeRangeMode: "dashboard",
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
      const queryModel = resolveConfiguredQueryModel(props);

      try {
        const runtimeStatePatch = await executeConnectionQueryWidgetRequest(
          props,
          context.dashboardState,
          queryModel,
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
        "Selects a backend-owned connection instance, query model, query payload, range behavior, optional variables, and row limit.",
      requiredSetupSteps: [
        "Select a configured connection instance.",
        "Choose the connection path exposed by the connection type.",
        "Configure the query payload and, when the path is time-range-aware, choose workspace dates or custom dates.",
        "Test the draft query in settings before binding consumers.",
        "Bind downstream widgets to the dataset output.",
      ],
      configurationNotes: [
        "The widget stores a stable ConnectionRef and query config, not credentials or endpoint URLs.",
        "The selected connection path is authoritative and is sent as query.kind.",
        "The widget always publishes one canonical tabular frame. Time-series semantics, when present, are carried in tabular metadata.",
        "Date runtime controls are only shown for time-range-aware connection paths.",
        "Connection-specific query editors are used when the connection type provides one.",
        "The widget is fixed to sidebar placement because it is a source/execution node, not a canvas presentation widget.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate", "upstream-update"],
      executionSummary:
        "Calls the selected connection query through the shared connection API and publishes the first matching response frame as one canonical tabular dataset.",
    },
    io: {
      mode: "dynamic",
      summary: "Publishes one canonical tabular dataset from a connection query response.",
      dynamicIoSummary:
        "The selected connection path metadata can populate time-series hints inside the canonical tabular frame metadata.",
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    },
    capabilities: {
      publishesContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      publishedContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      fixedPlacementMode: "sidebar",
      supportsConnectionQueryModels: true,
      supportsDashboardTimeRange: true,
      supportsFixedTimeRange: true,
      supportsVariables: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "Tabular connection source",
        summary: "Runs one explicit connection path and publishes rows for downstream widgets.",
        props: {
          timeRangeMode: "dashboard",
        },
      },
    ],
  },
  settingsComponent: ConnectionQueryWidgetSettings,
  component: ConnectionQueryWidget,
});
