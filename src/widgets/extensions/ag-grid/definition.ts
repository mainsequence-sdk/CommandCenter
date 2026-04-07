import { PositionsTableWidget } from "@/widgets/extensions/ag-grid/PositionsTableWidget";
import { defineWidget } from "@/widgets/types";

export const positionsTableWidget = defineWidget<Record<string, unknown>>({
  id: "positions-table",
  title: "Positions Table",
  description: "Main Sequence Markets positions table widget backed by AG Grid.",
  category: "Main Sequence Markets",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["portfolio:read"],
  tags: ["main-sequence", "markets", "portfolio", "positions", "ag-grid", "table"],
  exampleProps: {},
  component: PositionsTableWidget,
});
