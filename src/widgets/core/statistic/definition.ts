import { Calculator } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget, type ResolvedWidgetInputs } from "@/widgets/types";
import type { RuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import {
  resolveIncrementalTabularOutputFrame,
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  TABULAR_UPDATES_OUTPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  normalizeAnyTabularFrameSource,
  normalizeTabularWidgetSourceReferenceProps,
  TABULAR_SOURCE_CONTRACT,
  TABULAR_SOURCE_INPUT_ID,
  TABULAR_SOURCE_OUTPUT_ID,
} from "@/widgets/shared/tabular-widget-source";
import { selectPreferredUpstreamDataset } from "@/widgets/shared/upstream-consumer-state";
import { StatisticWidget } from "./StatisticWidget";
import { StatisticWidgetSettings } from "./StatisticWidgetSettings";
import { resolveStatisticSourceDataset, statisticDemoResolvedInputs } from "./statisticPreview";
import {
  buildStatisticCards,
  buildStatisticFieldOptions,
  resolveStatisticConfig,
  type StatisticWidgetProps,
} from "./statisticModel";

const STATISTIC_LIVE_UPDATE_MERGE_KEY_FIELDS: string[] = [];

function resolveStatisticSnapshotSourceDataset(input: {
  props: StatisticWidgetProps;
  resolvedInputs: ResolvedWidgetInputs | undefined;
  runtimeState?: Record<string, unknown>;
  runtimeDataStore?: RuntimeDataStore | null;
  resolveWidgetRuntimeState?: (instanceId: string | undefined) => Record<string, unknown> | undefined;
}) {
  const incrementalDataset = resolveIncrementalTabularOutputFrame({
    liveMergeKeyFields: STATISTIC_LIVE_UPDATE_MERGE_KEY_FIELDS,
    resolvedInputs: input.resolvedInputs,
    runtimeState: input.runtimeState,
    runtimeDataStore: input.runtimeDataStore,
  });

  if (incrementalDataset) {
    return incrementalDataset;
  }

  const legacyDataset = resolveStatisticSourceDataset(input.resolvedInputs);

  if (legacyDataset) {
    return legacyDataset;
  }

  const normalizeResolvedInput = (value: unknown) =>
    Array.isArray(value)
      ? value.find(
          (entry) =>
            Boolean(entry) &&
            typeof entry === "object" &&
            "status" in entry &&
            (entry as { status?: unknown }).status === "valid",
        ) ?? value[0]
      : value;

  const resolvedInputBinding = [
    normalizeResolvedInput(input.resolvedInputs?.[TABULAR_SOURCE_INPUT_ID]),
    normalizeResolvedInput(input.resolvedInputs?.[TABULAR_SEED_INPUT_ID]),
    normalizeResolvedInput(input.resolvedInputs?.[TABULAR_LIVE_UPDATES_INPUT_ID]),
  ].find((value) => value != null) as
    | {
        sourceWidgetId?: string;
        upstreamBase?: unknown;
        value?: unknown;
      }
    | undefined;

  const normalizedReference = normalizeTabularWidgetSourceReferenceProps(input.props);
  const sourceWidgetId = resolvedInputBinding?.sourceWidgetId ?? normalizedReference.sourceWidgetId;
  const inputFrame = normalizeAnyTabularFrameSource(
    resolvedInputBinding?.upstreamBase ?? resolvedInputBinding?.value,
  );
  const sourceRuntimeFrame = normalizeAnyTabularFrameSource(
    input.resolveWidgetRuntimeState?.(sourceWidgetId),
  );

  return selectPreferredUpstreamDataset(inputFrame, sourceRuntimeFrame);
}

export const statisticWidget = defineWidget<StatisticWidgetProps>({
  id: "statistic",
  widgetVersion: "3.0.3",
  title: "Statistic",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["tabular", "statistic", "kpi"],
  exampleProps: {
    statisticSourceMode: "bound",
    sourceMode: "filter_widget",
    statisticMode: "last",
  },
  mockProps: {
    statisticSourceMode: "bound",
    sourceMode: "filter_widget",
    statisticMode: "last",
    valueField: "yield",
    valueFieldLabel: "Current yield",
    groupField: "curve",
    orderField: "updated_at",
    suffix: "%",
    decimals: 2,
    columnCount: 3,
    colorMode: "change-from-last",
    showSourceLabel: true,
  },
  mockTitle: "Rates snapshot",
  mockResolvedInputs: statisticDemoResolvedInputs,
  io: {
    inputs: [
      {
        id: TABULAR_SEED_INPUT_ID,
        label: "Seed data",
        accepts: [TABULAR_SOURCE_CONTRACT],
        acceptedOutputIds: [TABULAR_SOURCE_OUTPUT_ID],
        required: false,
        effects: [
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "prop", path: "valueField" },
            description: "Upstream fields populate the value field choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "prop", path: "groupField" },
            description: "Upstream fields populate grouping choices.",
          },
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "statistic-cards" },
            description: "Incoming rows drive the statistic card output.",
          },
        ],
      },
      {
        id: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: "Live updates",
        accepts: [TABULAR_SOURCE_CONTRACT],
        acceptedOutputIds: [TABULAR_UPDATES_OUTPUT_ID],
        required: false,
        effects: [
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "prop", path: "valueField" },
            description: "Incremental source fields populate the value field choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "prop", path: "groupField" },
            description: "Incremental source fields populate grouping choices.",
          },
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "statistic-cards" },
            description: "Incoming incremental rows drive the statistic card output.",
          },
        ],
      },
    ],
  },
  workspaceRuntimeMode: "consumer",
  workspaceIcon: Calculator,
  buildAgentSnapshot: ({
    props,
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
    resolveWidgetRuntimeState,
  }) => {
    const sourceDataset = resolveStatisticSnapshotSourceDataset({
      props,
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
      resolveWidgetRuntimeState,
    });
    const availableFields = buildStatisticFieldOptions({
      columns: sourceDataset?.columns,
      fields: sourceDataset?.fields,
      rows: sourceDataset?.rows,
    });
    const resolvedConfig = resolveStatisticConfig(props, availableFields);
    const statisticResult = buildStatisticCards(sourceDataset?.rows ?? [], resolvedConfig);

    const state = sourceDataset
      ? sourceDataset.status === "error"
        ? "error"
        : sourceDataset.status === "loading"
          ? "loading"
          : sourceDataset.rows.length === 0
            ? "empty"
            : statisticResult.cards.length > 0
              ? "ready"
              : statisticResult.issue === "missing_value_field"
                ? "idle"
                : "empty"
      : "idle";

    const summary = sourceDataset
      ? sourceDataset.status === "error"
        ? sourceDataset.error ?? "Statistic source failed to load."
        : sourceDataset.status === "loading"
          ? "Statistic is loading its source dataset."
          : statisticResult.issue === "missing_value_field"
            ? "Statistic is waiting for a value field selection."
            : statisticResult.issue === "non_numeric_value_field"
              ? "Statistic requires a numeric value field for the selected mode."
              : statisticResult.cards.length > 0
                ? `${statisticResult.cards.length.toLocaleString()} statistic cards computed from ${sourceDataset.rows.length.toLocaleString()} rows.`
                : "Statistic source dataset has no rows."
      : "Statistic is waiting for an upstream dataset.";

    return {
      displayKind: "custom",
      state,
      summary,
      data: {
        widgetRole: "presentation",
        contentType: "statistic",
        issue: statisticResult.issue ?? null,
        cardCount: statisticResult.cards.length,
        cards: statisticResult.cards.map((card) => ({
          id: card.id,
          label: card.label,
          metricLabel: card.metricLabel,
          value: card.value,
          formattedValue: card.formattedValue,
          formattedPrimaryValue: card.formattedPrimaryValue,
          formattedSuffix: card.formattedSuffix,
          chartPoints: card.chartPoints?.slice(0, 100) ?? [],
          resolvedStyle: card.resolvedStyle ?? null,
        })),
      },
    };
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Reduces a bound tabular dataset or a widget-owned hidden connection or stream source into one or more statistic cards using selected value and grouping fields, per-card sparklines, and author-controlled columns.",
      requiredSetupSteps: [
        "Bind the widget to an upstream tabular dataset, or use Bindings -> Add connection to create a widget-owned hidden source.",
        "Choose a statistic mode and value field.",
        "Optionally choose grouping, column count, and presentation options.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes the canonical upstream dataset bundle and reduces it into rendered statistic cards without owning execution.",
    },
    io: {
      mode: "consumer",
      summary:
        "Consumes one canonical tabular frame and derives statistic cards from its rows.",
    },
    capabilities: {
      acceptedContracts: [TABULAR_SOURCE_CONTRACT],
      supportedSourceModes: ["bound", "connection"],
      supportedStatisticModes: ["last", "first", "sum", "mean", "min", "max", "count"],
      supportedColorModes: ["none", "range-rules", "change-from-last"],
      supportedRangeOperators: ["gt", "gte", "lt", "lte", "eq"],
      supportsSingleFieldGrouping: true,
      supportsColumnCount: true,
      supportsPerCardSparklines: true,
      supportsOrderField: true,
      supportsValueFieldDisplayLabel: true,
      supportsPrefixSuffixFormatting: true,
      supportsSourceLabelDisplay: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: StatisticWidgetSettings,
  component: StatisticWidget,
});
