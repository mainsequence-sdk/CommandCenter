import { CausalGraphWidget } from "@/widgets/core/causal-graph/CausalGraphWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const causalGraphWidget: WidgetDefinition<Record<string, unknown>> = {
  id: "causal-graph",
  title: "Causal Graph",
  description: "Mock causal propagation map for factor interactions and regime transmission.",
  category: "Quant",
  kind: "custom",
  source: "core",
  defaultSize: { w: 7, h: 8 },
  requiredPermissions: ["dashboard:view"],
  tags: ["quant", "causal", "graph"],
  component: CausalGraphWidget,
};
