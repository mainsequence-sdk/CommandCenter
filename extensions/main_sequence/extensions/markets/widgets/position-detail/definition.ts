import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { positionDetailExecutionDefinition } from "./positionDetailExecution";
import {
  PositionDetailWidget,
} from "./PositionDetailWidget";
import { PositionDetailWidgetSettings } from "./PositionDetailWidgetSettings";
import type { PositionDetailWidgetProps } from "./positionDetailRuntime";

export const positionDetailWidget = defineWidget<PositionDetailWidgetProps>({
  id: "position-detail",
  widgetVersion: "4.0.0",
  title: "Position Detail",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Markets",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["positions", "detail", "holdings", "tanstack"],
  exampleProps: {
    sourceType: "target_positions_account",
    accountUid: "managed-account-26",
    targetPositionsDate: "2026-05-19T10:30:00Z",
    variant: "positions",
  },
  mockProps: {
    editableInPlace: true,
    sourceType: "target_position",
    variant: "positions",
    positionRows: [
      {
        rowId: "mock-ust2y",
        assetId: 1,
        assetName: "US 2Y Note",
        assetTicker: "UST2Y",
        uniqueIdentifier: "US91282CJR34",
        figi: "BBG00JX7S9H4",
        date: "2026-05-18",
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
        date: "2026-05-18",
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
      : "Position Detail is waiting for data.",
    data: {
      widgetRole: "presentation",
      contentType: "table",
      sourceType: props.sourceType ?? null,
      portfolioId: props.portfolioId ?? null,
      accountUid: props.accountUid ?? null,
      holdingsDate: props.holdingsDate ?? null,
      targetPositionsDate: props.targetPositionsDate ?? null,
      targetPortfolioId: props.targetPortfolioId ?? null,
      variant: props.variant ?? null,
      editableInPlace: props.editableInPlace === true,
    },
  }),
  settingsComponent: PositionDetailWidgetSettings,
  execution: positionDetailExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Renders portfolio, account, target-position, or account-target-position rows. Account mode hydrates canonical holdings and can save a holdings snapshot back to the managed account. Target Positions Account mode saves an account-scoped target-position assignment.",
      fields: [
        {
          id: "sourceType",
          label: "Source type",
          type: "enum",
          required: false,
          source: "custom-settings",
        },
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
          id: "accountUid",
          label: "Account uid",
          type: "string",
          source: "custom-settings",
        },
        {
          id: "holdingsDate",
          label: "Holdings date",
          type: "string",
          source: "custom-settings",
        },
        {
          id: "targetPositionsDate",
          label: "Target positions date",
          type: "string",
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
          id: "positionRows",
          label: "Position rows",
          type: "array",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: [
        "Choose the source type first. Portfolio can hydrate from a portfolio id. Account can hydrate holdings and save them back. Target position and target positions account are authoring-first modes; the latter also writes an account-scoped target-position assignment.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate"],
      executionSummary:
        "Portfolio source can hydrate from the target portfolio weights endpoint. Account source can hydrate from the canonical holdings endpoint and, in edit mode, save a rewritten holdings snapshot through the managed-account holdings write endpoint. Target position remains local-authored, while Target Positions Account writes an account-scoped target-position assignment.",
    },
    io: {
      mode: "none",
      summary:
        "This widget does not participate in typed widget bindings. Portfolio and account can hydrate from their own queries; account edit mode can also save holdings back to the managed account. Target position renders local authored rows.",
    },
    capabilities: {
      supportedSourceTypes: [
        "portfolio",
        "account",
        "target_position",
        "target_positions_account",
      ],
      supportedVariants: ["summary", "positions"],
      supportedPositionTypes: [
        "weight_notional_exposure",
        "units",
        "constant_notional",
      ],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: PositionDetailWidget,
});
