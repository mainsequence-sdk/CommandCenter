import { Calculator } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { StatisticWidget } from "./StatisticWidget";
import { StatisticWidgetSettings } from "./StatisticWidgetSettings";
import type { MainSequenceDataNodeStatisticWidgetProps } from "./statisticModel";

export const mainSequenceDataNodeStatisticWidget = defineWidget<MainSequenceDataNodeStatisticWidgetProps>({
  id: "main-sequence-data-node-statistic",
  title: "Statistic",
  description: "Reduces a linked Data Node dataset into one or more statistic tiles.",
  category: "DataNodes",
  kind: "kpi",
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
  railIcon: Calculator,
  settingsComponent: StatisticWidgetSettings,
  component: StatisticWidget,
});
