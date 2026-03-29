import { defineWidget } from "@/widgets/types";

import {
  PortfolioWeightsWidget,
  type PortfolioWeightsWidgetProps,
} from "./PortfolioWeightsWidget";
import { PortfolioWeightsWidgetSettings } from "./PortfolioWeightsWidgetSettings";

export const portfolioWeightsWidget = defineWidget<PortfolioWeightsWidgetProps>({
  id: "portfolio-weights-table",
  title: "Portfolio Weights",
  description: "Reusable target-portfolio weights widget backed by the Markets weights-position-details endpoint.",
  category: "Portfolio",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["marketdata:read"],
  tags: ["portfolio", "weights", "positions", "tanstack"],
  exampleProps: {
    portfolioId: 1,
    variant: "positions",
  },
  settingsComponent: PortfolioWeightsWidgetSettings,
  component: PortfolioWeightsWidget,
});
