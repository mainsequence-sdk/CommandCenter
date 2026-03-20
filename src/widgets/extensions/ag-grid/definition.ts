import { PositionsTableWidget } from "@/widgets/extensions/ag-grid/PositionsTableWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const positionsTableWidget: WidgetDefinition<Record<string, unknown>> = {
  id: "positions-table",
  title: "Positions Table",
  description: "Optional AG Grid table widget for portfolio-heavy workflows.",
  category: "Portfolio",
  kind: "table",
  source: "ag-grid",
  defaultSize: { w: 8, h: 6 },
  requiredPermissions: ["portfolio:read"],
  tags: ["grid", "ag-grid", "portfolio", "optional"],
  exampleProps: {},
  component: PositionsTableWidget,
};
