import { Database } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { dataNodeFilterWidgetController } from "./controller";
import { dataNodeFilterExecutionDefinition } from "./dataNodeFilterExecution";
import { MainSequenceDataNodeFilterWidget } from "./MainSequenceDataNodeFilterWidget";
import { MainSequenceDataNodeFilterWidgetSettings } from "./MainSequenceDataNodeFilterWidgetSettings";
import { DataNodeRailSummary } from "./DataNodeRailSummary";
import {
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
  widgetVersion: "1.0.0",
  title: "Data Node",
  description: "Stores a reusable Main Sequence dataset node, with a settings-only table preview.",
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
    agentHints: {
      buildPurpose:
        "Use this widget as the canonical tabular data source when other widgets need to consume one reusable Main Sequence dataset bundle.",
      whenToUse: [
        "Use when a workspace needs one shared dataset that drives tables, charts, or statistics.",
        "Use when the source may come from a direct data node, another bound Data Node, or a manual table.",
      ],
      whenNotToUse: [
        "Do not use when the widget only needs to render an existing upstream dataset without owning execution.",
      ],
      authoringSteps: [
        "Select the source mode and source dataset.",
        "Set date range behavior and any unique identifier filters.",
        "Configure transform mode or output projection if the downstream shape needs to change.",
      ],
      blockingRequirements: [
        "Direct mode requires a valid data node id.",
        "Filter widget mode requires a valid bound upstream Data Node.",
      ],
      commonPitfalls: [
        "Pivot and unpivot modes need their key fields configured or the output shape will not match expectations.",
      ],
    },
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
