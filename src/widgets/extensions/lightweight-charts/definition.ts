import { PriceChartWidget } from "@/widgets/extensions/lightweight-charts/PriceChartWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const priceChartWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "price-chart",
  title: "Price Chart",
  description: "Optional Lightweight Charts widget wired to a mock market data stream.",
  category: "Market",
  kind: "chart",
  source: "lightweight-charts",
  defaultSize: { w: 8, h: 6 },
  requiredPermissions: ["marketdata:read"],
  tags: ["realtime", "market", "optional", "charts"],
  exampleProps: { symbol: "AAPL" },
  component: PriceChartWidget,
};
