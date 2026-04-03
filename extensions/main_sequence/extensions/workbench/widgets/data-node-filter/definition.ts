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
  title: "Data Node",
  description: "Stores a reusable Main Sequence dataset node, with a settings-only table preview.",
  category: "DataNodes",
  kind: "custom",
  source: "main_sequence_workbench",
  requiredPermissions: ["dashboard:view"],
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
  railIcon: Database,
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
  settingsComponent: MainSequenceDataNodeFilterWidgetSettings,
  component: MainSequenceDataNodeFilterWidget,
});
