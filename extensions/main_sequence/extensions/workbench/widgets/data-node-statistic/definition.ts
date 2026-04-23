import { Calculator } from "lucide-react";

import { resolveWidgetDescription } from "@/widgets/shared/widget-description";
import { defineWidget } from "@/widgets/types";

import descriptionMarkdown from "./DESCRIPTION.md?raw";
import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../widget-contracts/mainSequenceDataSourceBundle";
import { DATA_NODE_SOURCE_INPUT_ID } from "../data-node-shared/widgetBindings";
import { StatisticWidget } from "./StatisticWidget";
import { StatisticWidgetSettings } from "./StatisticWidgetSettings";
import type { MainSequenceDataNodeStatisticWidgetProps } from "./statisticModel";

export const mainSequenceDataNodeStatisticWidget = defineWidget<MainSequenceDataNodeStatisticWidgetProps>({
  id: "main-sequence-data-node-statistic",
  widgetVersion: "1.0.0",
  title: "Statistic",
  description: resolveWidgetDescription(descriptionMarkdown),
  category: "Main Sequence Data Nodes",
  kind: "custom",
  source: "main_sequence_workbench",
  requiredPermissions: ["main_sequence_foundry:view"],
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
  workspaceIcon: Calculator,
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Reduces a bound Data Node dataset into one or more statistic cards using selected value and grouping fields.",
      requiredSetupSteps: [
        "Bind the widget to an upstream Data Node dataset.",
        "Choose a statistic mode and value field.",
        "Optionally choose grouping and presentation options.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes the canonical upstream dataset bundle and reduces it into rendered statistic cards without owning execution.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one Main Sequence dataset bundle and derives statistic cards from its rows.",
    },
    capabilities: {
      acceptedContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      supportedStatisticModes: ["last", "first", "sum", "average", "min", "max", "count"],
    },
    agentHints: {
      buildPurpose:
        "Use this widget to surface one or more KPI-style values from a bound Data Node dataset.",
      whenToUse: [
        "Use when a Data Node dataset should be summarized into compact statistic cards.",
      ],
      whenNotToUse: [
        "Do not use when the user needs the full table or a chart instead of reduced KPIs.",
      ],
      authoringSteps: [
        "Bind the widget to a Data Node dataset.",
        "Select the value field and statistic mode.",
        "Optionally configure grouping and card presentation.",
      ],
      blockingRequirements: ["A compatible upstream Data Node binding is required."],
      commonPitfalls: [
        "Choosing a non-numeric value field limits which statistic modes are meaningful.",
      ],
    },
  },
  settingsComponent: StatisticWidgetSettings,
  component: StatisticWidget,
});
