import type { WidgetDefinition } from "@/widgets/types";

import {
  YieldCurvePlotWidget,
  type YieldCurvePlotWidgetProps,
} from "./YieldCurvePlotWidget";
import { YieldCurvePlotWidgetSettings } from "./YieldCurvePlotWidgetSettings";

export const yieldCurvePlotWidget: WidgetDefinition<YieldCurvePlotWidgetProps> = {
  id: "yield-curve-plot",
  title: "Yield Curve Plot",
  description: "Mock multi-curve rates plot for Demo dashboards rendered with Lightweight Charts.",
  category: "Market",
  kind: "chart",
  source: "demo",
  defaultSize: { w: 9, h: 7 },
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["rates", "yield-curve", "demo", "lightweight-charts", "mock"],
  exampleProps: {
    market: "ust",
    scenario: "desk",
    comparisonMode: "historical",
  },
  settingsComponent: YieldCurvePlotWidgetSettings,
  component: YieldCurvePlotWidget,
};
