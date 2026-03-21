import type { WidgetDefinition } from "@/widgets/types";

import {
  PortfolioWeightsWidget,
  type PortfolioWeightsWidgetProps,
} from "./PortfolioWeightsWidget";
import { PortfolioWeightsWidgetSettings } from "./PortfolioWeightsWidgetSettings";

export const portfolioWeightsWidget: WidgetDefinition<PortfolioWeightsWidgetProps> = {
  id: "portfolio-weights-table",
  title: "Portfolio Weights",
  description: "Reusable target-portfolio weights widget backed by the Markets weights-position-details endpoint.",
  category: "Portfolio",
  kind: "table",
  source: "main_sequence_markets",
  defaultSize: { w: 8, h: 6 },
  requiredPermissions: ["marketdata:read"],
  tags: ["portfolio", "weights", "positions", "tanstack"],
  exampleProps: {
    portfolioId: 1,
    variant: "positions",
  },
  settingsComponent: PortfolioWeightsWidgetSettings,
  component: PortfolioWeightsWidget,
};
