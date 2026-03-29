import { PriceChartWidget } from "@/widgets/extensions/lightweight-charts/PriceChartWidget";
import { defineWidget } from "@/widgets/types";

export const priceChartWidget = defineWidget<{ symbol?: string }>({
  id: "price-chart",
  title: "Price Chart",
  description: "Optional Lightweight Charts widget wired to a mock market data stream.",
  category: "Market",
  kind: "chart",
  source: "lightweight-charts",
  requiredPermissions: ["marketdata:read"],
  tags: ["realtime", "market", "optional", "charts"],
  exampleProps: { symbol: "AAPL" },
  component: PriceChartWidget,
});
