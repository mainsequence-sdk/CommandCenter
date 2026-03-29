import { PositionsTableWidget } from "@/widgets/extensions/ag-grid/PositionsTableWidget";
import { defineWidget } from "@/widgets/types";

export const positionsTableWidget = defineWidget<Record<string, unknown>>({
  id: "positions-table",
  title: "Positions Table",
  description: "Optional AG Grid table widget for portfolio-heavy workflows.",
  category: "Portfolio",
  kind: "table",
  source: "ag-grid",
  requiredPermissions: ["portfolio:read"],
  tags: ["grid", "ag-grid", "portfolio", "optional"],
  exampleProps: {},
  component: PositionsTableWidget,
});
