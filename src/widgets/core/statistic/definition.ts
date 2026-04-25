import { Calculator } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { TABULAR_SOURCE_CONTRACT } from "@/widgets/shared/tabular-widget-source";
import { TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import { StatisticWidget } from "./StatisticWidget";
import { StatisticWidgetSettings } from "./StatisticWidgetSettings";
import { statisticDemoResolvedInputs } from "./statisticPreview";
import type { StatisticWidgetProps } from "./statisticModel";

export const statisticWidget = defineWidget<StatisticWidgetProps>({
  id: "statistic",
  widgetVersion: "2.2.0",
  title: "Statistic",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["tabular", "statistic", "kpi"],
  exampleProps: {
    sourceMode: "filter_widget",
    statisticMode: "last",
  },
  mockProps: {
    sourceMode: "filter_widget",
    statisticMode: "last",
    valueField: "yield",
    valueFieldLabel: "Current yield",
    groupField: "curve",
    orderField: "updated_at",
    suffix: "%",
    decimals: 2,
    columnCount: 3,
    colorMode: "change-from-last",
    showSourceLabel: true,
  },
  mockTitle: "Rates snapshot",
  mockResolvedInputs: statisticDemoResolvedInputs,
  io: {
    inputs: [
      {
        id: TABULAR_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [TABULAR_SOURCE_CONTRACT],
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
        "Reduces a bound tabular dataset into one or more statistic cards using selected value and grouping fields, per-card sparklines, and author-controlled columns.",
      requiredSetupSteps: [
        "Bind the widget to an upstream tabular dataset.",
        "Choose a statistic mode and value field.",
        "Optionally choose grouping, column count, and presentation options.",
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
      summary:
        "Consumes one canonical tabular frame and derives statistic cards from its rows.",
    },
    capabilities: {
      acceptedContracts: [TABULAR_SOURCE_CONTRACT],
      supportedStatisticModes: ["last", "first", "sum", "mean", "min", "max", "count"],
      supportedColorModes: ["none", "range-rules", "change-from-last"],
      supportedRangeOperators: ["gt", "gte", "lt", "lte", "eq"],
      supportsSingleFieldGrouping: true,
      supportsColumnCount: true,
      supportsPerCardSparklines: true,
      supportsOrderField: true,
      supportsValueFieldDisplayLabel: true,
      supportsPrefixSuffixFormatting: true,
      supportsSourceLabelDisplay: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: StatisticWidgetSettings,
  component: StatisticWidget,
});
