import { PriceChartWidget } from "@/widgets/extensions/lightweight-charts/PriceChartWidget";
import { defineWidget } from "@/widgets/types";

export const priceChartWidget = defineWidget<{ symbol?: string }>({
  id: "price-chart",
  title: "Price Chart",
  description: "Main Sequence Markets price chart widget backed by Lightweight Charts.",
  category: "Main Sequence Markets",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["marketdata:read"],
  tags: ["main-sequence", "markets", "market", "price-chart", "lightweight-charts"],
  exampleProps: { symbol: "AAPL" },
  component: PriceChartWidget,
});
