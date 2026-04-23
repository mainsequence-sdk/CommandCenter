import { Database } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { dataNodeFilterWidgetController } from "./controller";
import { dataNodeFilterExecutionDefinition } from "./dataNodeFilterExecution";
import { MainSequenceDataNodeFilterWidget } from "./MainSequenceDataNodeFilterWidget";
import { MainSequenceDataNodeFilterWidgetSettings } from "./MainSequenceDataNodeFilterWidgetSettings";
import { DataNodeRailSummary } from "./DataNodeRailSummary";
import {
  normalizeDataNodeFilterProps,
  resolveDataNodePublishedOutput,
  type MainSequenceDataNodeFilterWidgetProps,
} from "./dataNodeFilterModel";
import { dataNodeFilterSettingsSchema } from "./schema";
import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../widget-contracts/mainSequenceDataSourceBundle";
import {
  DATA_NODE_SOURCE_INPUT_ID,
  DATA_NODE_SOURCE_OUTPUT_ID,
} from "../data-node-shared/widgetBindings";

export const mainSequenceDataNodeFilterWidget = defineWidget<MainSequenceDataNodeFilterWidgetProps>({
  id: "main-sequence-data-node",
  widgetVersion: "1.1.0",
  title: "Data Node",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Data Nodes",
  kind: "custom",
  source: "main_sequence_workbench",
  requiredPermissions: ["main_sequence_foundry:view"],
  tags: ["main-sequence", "data-node", "filter", "preview", "table"],
  exampleProps: {
    chromeMode: "minimal",
    dateRangeMode: "dashboard",
    showHeader: false,
  },
  mockProps: {
    chromeMode: "minimal",
    dataNodeId: 1084,
    dateRangeMode: "dashboard",
    showHeader: false,
  },
  defaultPresentation: {
    placementMode: "sidebar",
  },
  workspaceIcon: Database,
  railSummaryComponent: DataNodeRailSummary,
  buildAgentSnapshot: ({
    dashboardState,
    props,
    resolvedInputs,
    runtimeState,
    snapshotProfile,
  }) => {
    const normalizedProps = normalizeDataNodeFilterProps(props);
    const dataset = resolveDataNodePublishedOutput({
      props,
      runtimeState,
      resolvedInputs,
    });

    return {
      displayKind: "filter",
      state:
        dataset.status === "error"
          ? "error"
          : dataset.status === "loading"
            ? "loading"
            : dataset.status === "ready"
              ? dataset.rows.length > 0
                ? "ready"
                : "empty"
              : "idle",
      summary:
        dataset.status === "error"
          ? dataset.error || "Data Node dataset failed."
          : dataset.status === "loading"
            ? "Data Node dataset is loading."
            : dataset.status === "ready"
              ? `${dataset.rows.length.toLocaleString()} rows published across ${dataset.columns.length.toLocaleString()} columns.`
              : "Data Node is idle.",
      data: {
        sourceMode: normalizedProps.sourceMode ?? "direct",
        dataNodeId: normalizedProps.dataNodeId,
        dataNodeLabel: dataset.source?.label,
        status: dataset.status,
        error: dataset.error,
        columns: dataset.columns,
        fields: dataset.fields,
        rowCount: dataset.rows.length,
        rows:
          snapshotProfile === "full-data"
            ? dataset.rows
            : dataset.rows.slice(0, 25),
        rangeStartMs: dataset.rangeStartMs,
        rangeEndMs: dataset.rangeEndMs,
        uniqueIdentifierList: normalizedProps.uniqueIdentifierList ?? [],
        dashboardRange: dashboardState
          ? {
              timeRangeKey: dashboardState.timeRangeKey,
              rangeStartMs: dashboardState.rangeStartMs,
              rangeEndMs: dashboardState.rangeEndMs,
            }
          : undefined,
      },
    };
  },
  io: {
    inputs: [
      {
        id: DATA_NODE_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
        effects: [
          {
            kind: "drives-value",
            sourcePath: "dataNodeId",
            target: { kind: "prop", path: "dataNodeId" },
            description: "The bound source owns the effective data node selection.",
          },
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "preview" },
            description: "Upstream rows feed this Data Node preview and republished dataset.",
          },
        ],
      },
    ],
    outputs: [
      {
        id: DATA_NODE_SOURCE_OUTPUT_ID,
        label: "Dataset",
        contract: MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT,
        description:
          "Publishes the canonical Main Sequence dataset bundle for downstream widgets.",
        resolveValue: ({ props, runtimeState, resolvedInputs }) =>
          resolveDataNodePublishedOutput({
            props: props as MainSequenceDataNodeFilterWidgetProps,
            runtimeState,
            resolvedInputs,
          }),
      },
    ],
  },
  schema: dataNodeFilterSettingsSchema,
  controller: dataNodeFilterWidgetController,
  execution: dataNodeFilterExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    configuration: {
      mode: "hybrid",
      summary:
        "Configures a canonical dataset source and optional table transforms, then publishes the resulting dataset bundle for downstream widgets.",
      dynamicConfigSummary:
        "Authoring combines shared schema fields with richer custom settings for source selection, date range behavior, transforms, manual tables, and projection.",
      requiredSetupSteps: [
        "Choose a source mode: direct, linked Data Node, or manual table.",
        "Configure the source identifier or manual dataset.",
        "Optionally apply transform mode and output projection.",
      ],
      configurationNotes: [
        "Manual mode stores rows directly in widget props and still publishes through the same canonical dataset output.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate", "upstream-update"],
      executionSummary:
        "Owns canonical dataset loading and transformation for the Data Node family, then publishes the dataset bundle to downstream consumers.",
    },
    io: {
      mode: "static",
      summary:
        "Accepts an optional upstream dataset bundle and publishes one canonical dataset bundle for downstream bindings.",
      ioNotes: [
        "When bound to another Data Node, the bound source controls the effective data selection.",
      ],
    },
    capabilities: {
      supportedSourceModes: ["direct", "filter_widget", "manual"],
      supportedDateRangeModes: ["dashboard", "fixed"],
      supportedTransformModes: ["none", "aggregate", "pivot", "unpivot"],
      publishesContract: MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "Canonical bound dataset",
        summary: "Publishes one reusable Data Node bundle for linked consumer widgets.",
        props: {
          sourceMode: "filter_widget",
          dateRangeMode: "dashboard",
        },
      },
    ],
  },
  settingsComponent: MainSequenceDataNodeFilterWidgetSettings,
  component: MainSequenceDataNodeFilterWidget,
});
