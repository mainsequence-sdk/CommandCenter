import { StrategyBookWidget } from "@/widgets/extensions/strategy-book/StrategyBookWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const strategyBookWidget: WidgetDefinition<Record<string, unknown>> = {
  id: "strategy-book",
  title: "Strategy Book",
  description: "Flow Lab-owned positions grid for strategy monitoring surfaces.",
  category: "Execution",
  kind: "table",
  source: "flow-lab",
  defaultSize: { w: 8, h: 6 },
  requiredPermissions: ["portfolio:read"],
  tags: ["grid", "ag-grid", "positions", "strategy", "extension"],
  exampleProps: {},
  component: StrategyBookWidget,
};
