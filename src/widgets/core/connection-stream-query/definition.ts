import { DatabaseZap } from "lucide-react";

import { getConnectionTypeById } from "@/app/registry";
import { isConnectionQueryModelStreamable } from "@/connections/types";
import { connectionQuerySettingsSchema } from "@/widgets/core/connection-query/ConnectionQueryWidgetSchema";
import { TABULAR_UPDATES_OUTPUT_ID } from "@/widgets/shared/incremental-tabular-consumer";
import { projectWidgetRuntimeUpdateOutput } from "@/widgets/shared/runtime-update";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} from "@/widgets/shared/tabular-frame-source";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget, type WidgetIoDefinition, type WidgetSettingsSchema } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { ConnectionStreamQueryRailSummary } from "./ConnectionStreamQueryRailSummary";
import { ConnectionStreamQueryWidget } from "./ConnectionStreamQueryWidget";
import { ConnectionStreamQueryWidgetSettings } from "./ConnectionStreamQueryWidgetSettings";
import {
  buildConnectionStreamQueryLifecycleFrame,
  normalizeConnectionStreamQueryProps,
  normalizeConnectionStreamQueryRuntimeState,
  resolveConnectionStreamQueryOutput,
  type ConnectionStreamQueryWidgetProps,
} from "./connectionStreamQueryModel";

export const CONNECTION_STREAM_QUERY_DATASET_OUTPUT_ID = "dataset";

function resolveConfiguredStreamQueryModel(props: ConnectionStreamQueryWidgetProps) {
  const normalizedProps = normalizeConnectionStreamQueryProps(props);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;
  const queryModel = normalizedProps.queryModelId
    ? connectionType?.queryModels?.find((model) => model.id === normalizedProps.queryModelId)
    : undefined;

  return queryModel && isConnectionQueryModelStreamable(queryModel)
    ? queryModel
    : undefined;
}

function resolveConnectionStreamQueryIo(
  props: ConnectionStreamQueryWidgetProps,
): WidgetIoDefinition<ConnectionStreamQueryWidgetProps> {
  const queryModel = resolveConfiguredStreamQueryModel(props);

  return {
    outputs: [
      {
        id: CONNECTION_STREAM_QUERY_DATASET_OUTPUT_ID,
        label: queryModel ? `${queryModel.label} (WebSocket stream)` : "Unconfigured stream dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        description:
          `Publishes the ${queryModel?.id ?? "selected"} WebSocket connection stream as one canonical tabular dataset.`,
        valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: ({ props: outputProps, runtimeState }) => {
          const publishedFrame = resolveConnectionStreamQueryOutput(runtimeState);

          if (publishedFrame) {
            return publishedFrame;
          }

          return buildConnectionStreamQueryLifecycleFrame({
            props: outputProps,
            status: "idle",
          });
        },
      },
      {
        id: TABULAR_UPDATES_OUTPUT_ID,
        label: queryModel ? `${queryModel.label} live updates` : "Unconfigured live updates",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        description:
          `Publishes the ${queryModel?.id ?? "selected"} WebSocket stream as explicit incremental seed/update publications for live consumers.`,
        valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: ({ props: outputProps, runtimeState }) => {
          const publishedFrame = resolveConnectionStreamQueryOutput(runtimeState);

          if (!publishedFrame) {
            return buildConnectionStreamQueryLifecycleFrame({
              props: outputProps,
              status: "idle",
            });
          }

          return projectWidgetRuntimeUpdateOutput(publishedFrame, {
            outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
            sourceOutputId: TABULAR_UPDATES_OUTPUT_ID,
          });
        },
      },
    ],
  };
}

export const connectionStreamQueryWidget = defineWidget<ConnectionStreamQueryWidgetProps>({
  id: "connection-stream-query",
  widgetVersion: "1.1.0",
  title: "Connection Stream Query (WS)",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["connection", "stream", "websocket", "ws", "query", "source", "tabular", "data-source"],
  exampleProps: {
    query: {},
    timeRangeMode: "dashboard",
  },
  mockProps: {
    queryModelId: "example-stream-query",
    query: {
      kind: "example-stream-query",
    },
    timeRangeMode: "dashboard",
    mergeKeyFields: ["symbol"],
    retentionMaxRows: 500,
  },
  mockRuntimeState: {
    status: "ready",
    streamStatus: "live",
    columns: ["symbol", "price"],
    rows: [
      { symbol: "BTCUSDT", price: 70000 },
      { symbol: "ETHUSDT", price: 3500 },
    ],
    fields: [
      { key: "symbol", type: "string", provenance: "backend" },
      { key: "price", type: "number", provenance: "backend" },
    ],
    source: {
      kind: "connection-stream-query",
      label: "Example stream",
    },
  },
  workspaceIcon: DatabaseZap,
  railSummaryComponent: ConnectionStreamQueryRailSummary,
  defaultPresentation: {
    placementMode: "sidebar",
  },
  fixedPlacementMode: "sidebar",
  schema: connectionQuerySettingsSchema as WidgetSettingsSchema<ConnectionStreamQueryWidgetProps>,
  settingsSchemaPlacement: "custom",
  workspaceRuntimeMode: "execution-owner",
  buildAgentSnapshot: ({ props, runtimeState }) => {
    const normalizedProps = normalizeConnectionStreamQueryProps(props);
    const normalizedRuntimeState = normalizeConnectionStreamQueryRuntimeState(runtimeState);
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
          : normalizedRuntimeState?.streamStatus === "connecting" ||
              normalizedRuntimeState?.streamStatus === "reconnecting"
            ? "loading"
            : normalizedRuntimeState?.streamStatus === "live"
              ? "ready"
              : "idle",
      summary:
        normalizedRuntimeState?.status === "error"
          ? normalizedRuntimeState.error || "Connection stream query failed."
          : queryModel
            ? `${connectionType?.title ?? normalizedProps.connectionRef?.typeId ?? "Connection"} stream configured for ${queryModel.label}.`
            : "Connection stream query source is not fully configured.",
      data: {
        passthrough: true,
        widgetRole: "connection-source",
        connectionTypeName: connectionType?.title ?? normalizedProps.connectionRef?.typeId,
        connectionId: normalizedProps.connectionRef?.id ?? null,
        queryModelId: normalizedProps.queryModelId ?? null,
        queryModelLabel: queryModel?.label ?? null,
        status: normalizedRuntimeState?.status ?? "idle",
        streamStatus: normalizedRuntimeState?.streamStatus ?? "idle",
        timeRangeMode: normalizedProps.timeRangeMode ?? "dashboard",
      },
    };
  },
  io: resolveConnectionStreamQueryIo({}),
  resolveIo: ({ props }) => resolveConnectionStreamQueryIo(props),
  registryContract: {
    configuration: {
      mode: "hybrid",
      summary:
        "Selects a backend-owned connection instance, WebSocket-streamable query model, typed query payload, range behavior, optional variables, row limit, merge keys, and retention limit.",
      requiredSetupSteps: [
        "Select a configured connection instance.",
        "Choose a connection path that advertises stream.transport websocket.",
        "Configure the same typed query payload used by the connection query widget.",
        "Bind downstream widgets to the updates output for live incremental behavior, or dataset for retained compatibility.",
      ],
      configurationNotes: [
        "The widget stores a stable ConnectionRef, query config, merge-key fields, and retention count. It does not store credentials, endpoint URLs, or provider route fragments.",
        "Only query models with WebSocket stream metadata can be selected.",
        "Connection-specific query editors are reused from the selected connection type.",
        "Delta-origin messages publish incremental update publications. Snapshot-origin messages republish full seed resets so live consumers can reset instead of misreading replacement snapshots as append-only deltas.",
        "The dataset output keeps a retained compatibility bridge. The updates output carries the explicit incremental publication contract for seed/update consumers.",
        "The widget is fixed to sidebar placement because it is a source node, not a canvas presentation widget.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Mounts one WebSocket subscription for the selected streamable connection query and publishes canonical tabular runtime state as messages arrive. Dashboard refresh does not execute this widget; the socket lifecycle owns publication.",
      notes: [
        "Lifecycle state is stored as streamStatus: idle, connecting, live, reconnecting, error, or closed.",
        "The canonical output status maps lifecycle into idle/loading/ready/error so shared upstream consumer-state helpers can resolve awaiting, loading, ready, empty, and error states.",
      ],
    },
    io: {
      mode: "dynamic",
      summary: "Publishes one canonical tabular dataset from a WebSocket connection query stream.",
      dynamicIoSummary:
        "The selected streamable connection path metadata controls whether snapshots, deltas, or both are accepted.",
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    },
    capabilities: {
      publishesContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      publishedContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      fixedPlacementMode: "sidebar",
      supportsConnectionQueryModels: true,
      supportsConnectionQueryStreams: true,
      supportsDashboardTimeRange: true,
      supportsFixedTimeRange: true,
      supportsVariables: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "Streaming tabular connection source",
        summary: "Opens one streamable connection path and publishes retained rows for downstream widgets.",
        props: {
          timeRangeMode: "dashboard",
        },
      },
    ],
  },
  settingsComponent: ConnectionStreamQueryWidgetSettings,
  component: ConnectionStreamQueryWidget,
});
