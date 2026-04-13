import { PriceChartWidget } from "@/widgets/extensions/lightweight-charts/PriceChartWidget";
import { defineWidget } from "@/widgets/types";

export const priceChartWidget = defineWidget<{ symbol?: string }>({
  id: "price-chart",
  widgetVersion: "1.0.0",
  title: "Price Chart",
  description: "Main Sequence Markets price chart widget backed by Lightweight Charts.",
  category: "Main Sequence Markets",
  kind: "chart",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["main-sequence", "markets", "market", "price-chart", "lightweight-charts"],
  exampleProps: { symbol: "AAPL" },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Configures a simple symbol-driven legacy price chart widget.",
      fields: [
        {
          id: "symbol",
          label: "Symbol",
          type: "string",
          source: "custom-settings",
        },
      ],
    },
    io: {
      mode: "none",
      summary: "This legacy chart widget owns its own local query behavior and does not use typed widget IO.",
    },
    agentHints: {
      buildPurpose: "Use this widget for a legacy simple market price chart.",
      whenToUse: ["Use only when this legacy lightweight-charts widget is explicitly desired."],
      whenNotToUse: ["Do not use when a newer data-node-backed chart should own the visualization."],
      authoringSteps: ["Set the symbol to chart."],
      blockingRequirements: [],
      commonPitfalls: ["This widget is not part of the canonical typed Data Node chart pipeline."],
    },
  },
  component: PriceChartWidget,
});
