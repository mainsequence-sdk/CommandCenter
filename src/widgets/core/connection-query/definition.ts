import { Database } from "lucide-react";

import { getConnectionTypeById } from "@/app/registry";
import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import { TABULAR_UPDATES_OUTPUT_ID } from "@/widgets/shared/incremental-tabular-consumer";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { projectWidgetRuntimeUpdateOutput } from "@/widgets/shared/runtime-update";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} from "@/widgets/shared/tabular-frame-source";
import { defineWidget, type WidgetIoDefinition } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { ConnectionQueryRailSummary } from "./ConnectionQueryRailSummary";
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
import { connectionQuerySettingsSchema } from "./ConnectionQueryWidgetSchema";

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
      {
        id: TABULAR_UPDATES_OUTPUT_ID,
        label: queryModel ? `${queryModel.label} incremental updates` : "Unconfigured incremental updates",
        contract: outputContract,
        description:
          `Publishes the ${queryModel?.id ?? "selected"} connection path as one explicit incremental publication stream for seed/update consumers.`,
        valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: ({ runtimeState: resolvedRuntimeState }) => {
          const publishedFrame = normalizeConnectionQueryRuntimeState(resolvedRuntimeState);

          if (!publishedFrame) {
            return {
              status: "idle",
              columns: [],
              rows: [],
            };
          }

          return projectWidgetRuntimeUpdateOutput(publishedFrame, {
            outputContractId: outputContract,
            sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
          });
        },
      },
    ],
  };
}

export const connectionQueryWidget = defineWidget<ConnectionQueryWidgetProps>({
  id: "connection-query",
  widgetVersion: "1.6.1",
  title: "Connection Query (HTTP)",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["connection", "query", "http", "source", "tabular", "data-source"],
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
  railSummaryComponent: ConnectionQueryRailSummary,
  defaultPresentation: {
    placementMode: "sidebar",
  },
  fixedPlacementMode: "sidebar",
  schema: connectionQuerySettingsSchema,
  settingsSchemaPlacement: "custom",
  workspaceRuntimeMode: "execution-owner",
  buildAgentSnapshot: ({ props, runtimeState }) => {
    const normalizedProps = normalizeConnectionQueryProps(props);
    const normalizedRuntimeState = normalizeConnectionQueryRuntimeState(runtimeState);
    const connectionType = normalizedProps.connectionRef?.typeId
      ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
      : undefined;
    const queryModel = normalizedProps.queryModelId
      ? connectionType?.queryModels?.find((model) => model.id === normalizedProps.queryModelId)
      : undefined;

    return {
      displayKind: "custom",
      state:
        normalizedRuntimeState?.status === "error"
          ? "error"
          : normalizedRuntimeState?.status === "loading"
            ? "loading"
            : normalizedRuntimeState?.status === "ready"
              ? "ready"
              : "idle",
      summary:
        normalizedRuntimeState?.status === "error"
          ? normalizedRuntimeState.error || "Connection query failed."
          : queryModel
            ? `${connectionType?.title ?? normalizedProps.connectionRef?.typeId ?? "Connection"} source configured for ${queryModel.label}.`
            : "Connection query source is not fully configured.",
      data: {
        passthrough: true,
        widgetRole: "connection-source",
        connectionTypeName: connectionType?.title ?? normalizedProps.connectionRef?.typeId,
        connectionId: normalizedProps.connectionRef?.id ?? null,
        queryModelId: normalizedProps.queryModelId ?? null,
        queryModelLabel: queryModel?.label ?? null,
        outputContract: resolveConfiguredOutputContract(normalizedProps),
        status: normalizedRuntimeState?.status ?? "idle",
        timeRangeMode: normalizedProps.timeRangeMode ?? "dashboard",
      },
    };
  },
  io: resolveConnectionQueryIo({}),
  resolveIo: ({ props, runtimeState }) => resolveConnectionQueryIo(props, runtimeState),
  execution: {
    canExecute: (context) => {
      const props = normalizeConnectionQueryProps(context.targetOverrides?.props ?? context.props);
      return Boolean(props.connectionRef?.id && props.queryModelId);
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
          {
            ownerId: context.instanceId,
            runtimeDataStore: context.runtimeDataStore,
            scopeId: context.instanceId,
            executionSurface: context.executionSurface,
            publicExecution: context.publicExecution,
            publicWorkspaceToken: context.publicWorkspaceToken,
            forceFullRefresh:
              context.reason === "manual-submit" ||
              context.reason === "manual-recalculate" ||
              context.refreshCycleId?.startsWith("initial:") === true,
            traceMeta: buildDashboardExecutionRequestTraceMeta(context),
            signal: context.signal,
          },
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
      return props.connectionRef?.id && props.queryModelId ? "allow-refresh" : "manual-only";
    },
    getExecutionKey: (context) => `connection-query:${context.instanceId}`,
  },
  registryContract: {
    configuration: {
      mode: "hybrid",
      summary:
        "Selects a backend-owned connection instance, query model, individually poppable connection-specific query fields, range behavior, optional variables, row limit, and optional incremental refresh.",
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
        "Incremental refresh is configured per widget instance. The time field controls tail requests and retention pruning; the merge-key column combination controls dedupe and row replacement.",
        "Non-delta consumers still receive the retained full dataset as a snapshot and do not force this source to issue a second backend query.",
        "Connection-specific query editors are used when the connection type provides one.",
        "Connection-specific path settings are schema-backed per field and can be exposed individually as companion cards on the workspace canvas.",
        "The widget is fixed to sidebar placement because it is a source/execution node, not a canvas presentation widget.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate", "upstream-update"],
      executionSummary:
        "Calls the selected connection query through the shared connection API and publishes the first matching response frame as one canonical tabular dataset. When incremental refresh is enabled, follow-up workspace refreshes request the tail range, merge rows in memory, and publish the retained full dataset with the shared widget-runtime-update@v1 envelope.",
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
      supportsIncrementalRefresh: true,
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
