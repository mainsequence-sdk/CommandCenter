import type { WidgetDefinition } from "@/widgets/types";

import { MarketKpisWidget } from "./MarketKpisWidget";

export const marketKpisWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "market-kpis",
  title: "Market KPIs",
  description: "Small summary cards for desk, exposure, and alert metrics.",
  category: "Market",
  kind: "custom",
  source: "demo",
  defaultSize: { w: 4, h: 4 },
  requiredPermissions: ["dashboard:view"],
  tags: ["summary", "cards", "demo"],
  exampleProps: { symbol: "AAPL" },
  component: MarketKpisWidget,
};
