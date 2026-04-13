import { defineWidget } from "@/widgets/types";

import { portfolioWeightsExecutionDefinition } from "./portfolioWeightsExecution";
import {
  PortfolioWeightsWidget,
} from "./PortfolioWeightsWidget";
import { PortfolioWeightsWidgetSettings } from "./PortfolioWeightsWidgetSettings";
import type { PortfolioWeightsWidgetProps } from "./portfolioWeightsRuntime";

export const portfolioWeightsWidget = defineWidget<PortfolioWeightsWidgetProps>({
  id: "portfolio-weights-table",
  widgetVersion: "1.0.0",
  title: "Portfolio Weights",
  description: "Reusable target-portfolio weights widget backed by the Markets weights-position-details endpoint.",
  category: "Main Sequence Markets",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["portfolio", "weights", "positions", "tanstack"],
  exampleProps: {
    portfolioId: 1,
    variant: "positions",
  },
  settingsComponent: PortfolioWeightsWidgetSettings,
  execution: portfolioWeightsExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Loads a target portfolio weights table for one portfolio id and presentation variant.",
      fields: [
        {
          id: "portfolioId",
          label: "Portfolio id",
          type: "integer",
          required: true,
          source: "custom-settings",
        },
        {
          id: "targetPortfolioId",
          label: "Target portfolio id",
          type: "integer",
          source: "custom-settings",
        },
        {
          id: "variant",
          label: "Variant",
          type: "enum",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: ["Select the target portfolio id and desired variant."],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate"],
      executionSummary:
        "Owns the portfolio weights data request and publishes the runtime payload used by the table.",
    },
    io: {
      mode: "none",
      summary: "This widget owns its own portfolio weights query and does not participate in typed widget bindings.",
    },
    capabilities: {
      supportedVariants: ["summary", "positions"],
    },
    agentHints: {
      buildPurpose:
        "Use this widget to show target portfolio weights in summary or positions form for one portfolio.",
      whenToUse: [
        "Use when portfolio weights should be fetched directly from the Markets portfolio weights endpoint.",
      ],
      whenNotToUse: [
        "Do not use when the source data already exists as a reusable Data Node dataset.",
      ],
      authoringSteps: [
        "Set the portfolio id or target portfolio id.",
        "Choose whether the table should show summary or positions.",
      ],
      blockingRequirements: ["A valid portfolio identifier is required."],
      commonPitfalls: [
        "The variant changes which columns and row shape the runtime payload exposes.",
      ],
    },
  },
  component: PortfolioWeightsWidget,
});
