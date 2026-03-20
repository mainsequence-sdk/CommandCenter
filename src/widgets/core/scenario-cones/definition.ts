import { ScenarioConesWidget } from "@/widgets/core/scenario-cones/ScenarioConesWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const scenarioConesWidget: WidgetDefinition<Record<string, unknown>> = {
  id: "scenario-cones",
  title: "Scenario Cones",
  description: "Mock probability cones for competing market regime paths.",
  category: "Quant",
  kind: "custom",
  source: "core",
  defaultSize: { w: 6, h: 6 },
  requiredPermissions: ["dashboard:view"],
  tags: ["quant", "scenario", "regime"],
  component: ScenarioConesWidget,
};
