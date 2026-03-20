import { DistributionLabWidget } from "@/widgets/core/distribution-lab/DistributionLabWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const distributionLabWidget: WidgetDefinition<Record<string, unknown>> = {
  id: "distribution-lab",
  title: "Distribution Lab",
  description: "Mock distribution diagnostics with baseline, live, and stress densities.",
  category: "Quant",
  kind: "custom",
  source: "core",
  defaultSize: { w: 6, h: 6 },
  requiredPermissions: ["dashboard:view"],
  tags: ["quant", "distribution", "risk"],
  component: DistributionLabWidget,
};
