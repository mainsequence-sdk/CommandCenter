import { defineWidget } from "@/widgets/types";

import { portfolioWeightsExecutionDefinition } from "./portfolioWeightsExecution";
import {
  PortfolioWeightsWidget,
} from "./PortfolioWeightsWidget";
import { PortfolioWeightsWidgetSettings } from "./PortfolioWeightsWidgetSettings";
import type { PortfolioWeightsWidgetProps } from "./portfolioWeightsRuntime";

export const portfolioWeightsWidget = defineWidget<PortfolioWeightsWidgetProps>({
  id: "portfolio-weights-table",
  title: "Portfolio Weights",
  description: "Reusable target-portfolio weights widget backed by the Markets weights-position-details endpoint.",
  category: "Main Sequence Markets",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["marketdata:read"],
  tags: ["portfolio", "weights", "positions", "tanstack"],
  exampleProps: {
    portfolioId: 1,
    variant: "positions",
  },
  settingsComponent: PortfolioWeightsWidgetSettings,
  execution: portfolioWeightsExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  component: PortfolioWeightsWidget,
});
