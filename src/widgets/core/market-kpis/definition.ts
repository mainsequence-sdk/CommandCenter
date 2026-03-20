import { MarketKpisWidget } from "@/widgets/core/market-kpis/MarketKpisWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const marketKpisWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "market-kpis",
  title: "Market KPIs",
  description: "Small summary cards for desk, exposure and alert metrics.",
  category: "Market",
  kind: "kpi",
  source: "core",
  defaultSize: { w: 4, h: 4 },
  requiredPermissions: ["dashboard:view"],
  tags: ["summary", "cards"],
  exampleProps: { symbol: "AAPL" },
  component: MarketKpisWidget,
};
