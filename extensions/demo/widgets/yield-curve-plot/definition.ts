import { resolveWidgetDescription } from "@/widgets/shared/widget-description";
import type { WidgetDefinition } from "@/widgets/types";

import descriptionMarkdown from "./DESCRIPTION.md?raw";
import {
  YieldCurvePlotWidget,
  type YieldCurvePlotWidgetProps,
} from "./YieldCurvePlotWidget";
import { YieldCurvePlotWidgetSettings } from "./YieldCurvePlotWidgetSettings";

export const yieldCurvePlotWidget: WidgetDefinition<YieldCurvePlotWidgetProps> = {
  id: "yield-curve-plot",
  widgetVersion: "1.0.0",
  title: "Yield Curve Plot",
  description: resolveWidgetDescription(descriptionMarkdown),
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
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Configures a demo multi-curve rates plot for one market and comparison mode.",
      requiredSetupSteps: ["Select the market, scenario, and comparison mode."],
    },
    io: {
      mode: "none",
      summary: "This demo widget does not participate in the standardized typed IO model.",
    },
    agentHints: {
      buildPurpose: "Use this widget only for demo yield-curve visualizations backed by mock data.",
      whenToUse: ["Use in demo dashboards where mock curve scenarios are acceptable."],
      whenNotToUse: ["Do not use for production typed workspace authoring."],
      authoringSteps: ["Set the market and comparison mode."],
      blockingRequirements: [],
      commonPitfalls: ["This is demo-only and not part of the Main Sequence Data Node runtime pipeline."],
    },
  },
  component: YieldCurvePlotWidget,
};
