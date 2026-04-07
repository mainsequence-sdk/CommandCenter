import { Calculator } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../widget-contracts/mainSequenceDataSourceBundle";
import { DATA_NODE_SOURCE_INPUT_ID } from "../data-node-shared/widgetBindings";
import { StatisticWidget } from "./StatisticWidget";
import { StatisticWidgetSettings } from "./StatisticWidgetSettings";
import type { MainSequenceDataNodeStatisticWidgetProps } from "./statisticModel";

export const mainSequenceDataNodeStatisticWidget = defineWidget<MainSequenceDataNodeStatisticWidgetProps>({
  id: "main-sequence-data-node-statistic",
  title: "Statistic",
  description: "Reduces a linked Data Node dataset into one or more statistic tiles.",
  category: "Main Sequence Data Nodes",
  kind: "custom",
  source: "main_sequence_workbench",
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "statistic", "kpi"],
  exampleProps: {
    sourceMode: "filter_widget",
    statisticMode: "last",
  },
  mockProps: {
    sourceMode: "filter_widget",
    statisticMode: "last",
  },
  io: {
    inputs: [
      {
        id: DATA_NODE_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
        required: true,
        effects: [
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "prop", path: "valueField" },
            description: "Upstream fields populate the value field choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "prop", path: "groupField" },
            description: "Upstream fields populate grouping choices.",
          },
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "statistic-cards" },
            description: "Incoming rows drive the statistic card output.",
          },
        ],
      },
    ],
  },
  workspaceRuntimeMode: "consumer",
  railIcon: Calculator,
  settingsComponent: StatisticWidgetSettings,
  component: StatisticWidget,
});
