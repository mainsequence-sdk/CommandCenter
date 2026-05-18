import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { portfolioWeightsExecutionDefinition } from "./portfolioWeightsExecution";
import {
  PortfolioWeightsWidget,
} from "./PortfolioWeightsWidget";
import { PortfolioWeightsWidgetSettings } from "./PortfolioWeightsWidgetSettings";
import type { PortfolioWeightsWidgetProps } from "./portfolioWeightsRuntime";

export const portfolioWeightsWidget = defineWidget<PortfolioWeightsWidgetProps>({
  id: "portfolio-weights-table",
  widgetVersion: "2.0.0",
  title: "Portfolio Weights",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Markets",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["portfolio", "weights", "positions", "tanstack"],
  exampleProps: {
    portfolioId: 1,
    variant: "positions",
  },
  mockProps: {
    editableInPlace: true,
    dataMode: "inline",
    variant: "positions",
    inlineRows: [
      {
        rowId: "mock-ust2y",
        assetId: 1,
        assetName: "US 2Y Note",
        assetTicker: "UST2Y",
        uniqueIdentifier: "US91282CJR34",
        figi: "BBG00JX7S9H4",
        positionType: "weight_notional_exposure",
        positionValue: 0.184,
      },
      {
        rowId: "mock-ust10y",
        assetId: 2,
        assetName: "US 10Y Note",
        assetTicker: "UST10Y",
        uniqueIdentifier: "US91282CLM67",
        figi: "BBG00L0J2D82",
        positionType: "constant_notional",
        positionValue: 2500000,
      },
    ],
  },
  buildAgentSnapshot: ({ props, domTextContent, runtimeState }) => ({
    displayKind: "table",
    state: domTextContent?.trim()
      ? "ready"
      : runtimeState
        ? "loading"
        : "idle",
    summary: domTextContent?.trim()
      ? domTextContent.trim().slice(0, 240)
      : "Portfolio Weights is waiting for portfolio data.",
    data: {
      widgetRole: "presentation",
      contentType: "table",
      portfolioId: props.portfolioId ?? null,
      targetPortfolioId: props.targetPortfolioId ?? null,
      variant: props.variant ?? null,
      editableInPlace: props.editableInPlace === true,
      dataMode: props.dataMode ?? null,
    },
  }),
  settingsComponent: PortfolioWeightsWidgetSettings,
  execution: portfolioWeightsExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Loads a target portfolio weights table from a portfolio id or lets authors manage inline positions directly on the canvas.",
      fields: [
        {
          id: "portfolioId",
          label: "Portfolio id",
          type: "integer",
          required: false,
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
        {
          id: "editableInPlace",
          label: "Editable in place",
          type: "boolean",
          source: "custom-settings",
        },
        {
          id: "dataMode",
          label: "Data mode",
          type: "enum",
          source: "custom-settings",
        },
        {
          id: "inlineRows",
          label: "Inline rows",
          type: "array",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: [
        "Choose portfolio mode and set a portfolio id, or enable Editable in place and add assets directly on the widget.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate"],
      executionSummary:
        "Portfolio mode owns the backend weights request. Inline mode renders persisted local rows and does not execute a backend fetch.",
    },
    io: {
      mode: "none",
      summary: "This widget does not participate in typed widget bindings. In portfolio mode it owns its own query; in inline mode it renders local authored rows.",
    },
    capabilities: {
      supportedVariants: ["summary", "positions"],
      supportedPositionTypes: [
        "weight_notional_exposure",
        "units",
        "constant_notional",
      ],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: PortfolioWeightsWidget,
});
