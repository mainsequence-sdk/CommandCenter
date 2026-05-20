import { Shuffle } from "lucide-react";

import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
} from "@/widgets/shared/tabular-frame-source";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { TabularTransformWidget } from "./TabularTransformWidget";
import { TabularTransformWidgetSettings } from "./TabularTransformWidgetSettings";
import {
  TABULAR_TRANSFORM_DATASET_OUTPUT_ID,
  TABULAR_TRANSFORM_SOURCE_INPUT_ID,
  normalizeTabularTransformProps,
  resolveTabularTransformOutput,
  type TabularTransformWidgetProps,
} from "./tabularTransformModel";

export const tabularTransformWidget = defineWidget<TabularTransformWidgetProps>({
  id: "tabular-transform",
  widgetVersion: "1.2.0",
  title: "Tabular Transform",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["tabular", "transform", "filter", "aggregate", "pivot", "unpivot", "projection", "formula"],
  exampleProps: {
    transformMode: "none",
    aggregateMode: "last",
    computedColumns: [
      {
        key: "net_change",
        label: "Net Chg",
        type: "number",
        formulaExpression: "[last_price] - [previous_close]",
      },
    ],
  },
  mockProps: {
    transformMode: "aggregate",
    aggregateMode: "mean",
    keyFields: ["series"],
    computedColumns: [
      {
        key: "value_x10",
        label: "Value x10",
        type: "number",
        formulaExpression: "[value] * 10",
      },
    ],
    projectFields: ["series", "value"],
  },
  mockResolvedInputs: {
    [TABULAR_TRANSFORM_SOURCE_INPUT_ID]: {
      inputId: TABULAR_TRANSFORM_SOURCE_INPUT_ID,
      label: "Source data",
      status: "valid",
      sourceWidgetId: "mock-source",
      sourceOutputId: "dataset",
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      value: {
        status: "ready",
        columns: ["series", "value"],
        rows: [
          { series: "A", value: 1 },
          { series: "A", value: 3 },
          { series: "B", value: 8 },
        ],
      },
    },
  },
  workspaceIcon: Shuffle,
  workspaceRuntimeMode: "execution-owner",
  buildAgentSnapshot: ({ props, resolvedInputs, runtimeState }) => {
    const normalizedProps = normalizeTabularTransformProps(props);
    const output = resolveTabularTransformOutput({
      props: normalizedProps,
      runtimeState,
      resolvedInputs,
    });

    return {
      displayKind: "custom",
      state:
        output.status === "error"
          ? "error"
          : output.status === "loading"
            ? "loading"
            : output.status === "ready"
              ? "ready"
              : output.status === "idle"
                ? "idle"
                : "empty",
      summary:
        output.status === "error"
          ? output.error || "Tabular transform failed."
          : normalizedProps.transformMode === "none"
            ? "Tabular transform is configured as a passthrough transform."
            : `Tabular transform is configured in ${normalizedProps.transformMode} mode.`,
      data: {
        passthrough: true,
        widgetRole: "transformer",
        transformMode: normalizedProps.transformMode,
        aggregateMode: normalizedProps.aggregateMode,
        keyFields: normalizedProps.keyFields,
        projectFields: normalizedProps.projectFields,
        status: output.status,
      },
    };
  },
  io: {
    inputs: [
      {
        id: TABULAR_TRANSFORM_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
        required: true,
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "transform" },
            description: "Incoming rows are transformed and republished.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "render", id: "field-options" },
            description: "Upstream fields define available transform field choices.",
          },
        ],
      },
    ],
    outputs: [
      {
        id: TABULAR_TRANSFORM_DATASET_OUTPUT_ID,
        label: "Dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        description: "Publishes the transformed tabular dataset.",
        valueDescriptor: TABULAR_FRAME_SOURCE_VALUE_DESCRIPTOR,
        resolveValue: ({ props, runtimeState, resolvedInputs }) =>
          resolveTabularTransformOutput({
            props: props as TabularTransformWidgetProps,
            runtimeState,
            resolvedInputs,
          }),
      },
    ],
  },
  execution: {
    canExecute: (context) => {
      const output = resolveTabularTransformOutput({
        props: normalizeTabularTransformProps(
          (context.targetOverrides?.props ?? context.props) as TabularTransformWidgetProps,
        ),
        runtimeState: context.targetOverrides?.runtimeState ?? context.runtimeState,
        resolvedInputs: context.resolvedInputs,
      });

      return output.status !== "idle" && output.status !== "error";
    },
    execute: async (context) => {
      const output = resolveTabularTransformOutput({
        props: normalizeTabularTransformProps(
          (context.targetOverrides?.props ?? context.props) as TabularTransformWidgetProps,
        ),
        runtimeState: context.targetOverrides?.runtimeState ?? context.runtimeState,
        resolvedInputs: context.resolvedInputs,
      });

      if (output.status === "error") {
        return {
          status: "error",
          error: output.error,
          runtimeStatePatch: output as unknown as Record<string, unknown>,
        };
      }

      return {
        status: "success",
        runtimeStatePatch: output as unknown as Record<string, unknown>,
      };
    },
    getRefreshPolicy: (context) => {
      const output = resolveTabularTransformOutput({
        props: normalizeTabularTransformProps(
          (context.targetOverrides?.props ?? context.props) as TabularTransformWidgetProps,
        ),
        runtimeState: context.targetOverrides?.runtimeState ?? context.runtimeState,
        resolvedInputs: context.resolvedInputs,
      });

      return output.status === "idle" || output.status === "error"
        ? "manual-only"
        : "allow-refresh";
    },
    getExecutionKey: (context) => `tabular-transform:${context.instanceId}`,
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Configures a visible graph transform over one tabular dataset, including filter, aggregate, pivot, unpivot, and projection.",
      requiredSetupSteps: [
        "Bind sourceData to an upstream tabular dataset.",
        "Select a transform mode.",
        "Configure filter, key, pivot, unpivot, computed-column, or projection fields.",
        "Bind downstream widgets to the transformed dataset output.",
      ],
      configurationNotes: [
        "Projection runs after the selected transform.",
        "Computed columns run after the selected transform and before projection.",
        "Computed-column formulas must wrap field names in brackets, for example [last_price] * 10.",
        "Filter mode is intentionally limited to lightweight field predicates.",
        "Analytical transforms are explicit graph nodes, not binding-level transforms.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate", "upstream-update"],
      executionSummary:
        "Reads the resolved upstream tabular frame, applies the saved transform configuration, and publishes a new tabular frame.",
    },
    io: {
      mode: "static",
      summary: "Consumes one tabular dataset and publishes one transformed tabular dataset.",
      inputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    },
    capabilities: {
      acceptedContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      publishesContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      supportedTransformModes: ["none", "filter", "aggregate", "pivot", "unpivot"],
      supportedAggregateModes: ["first", "last", "sum", "mean", "min", "max"],
      supportsComputedColumns: true,
      supportsProjection: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "Aggregate connection query rows",
        summary: "Groups source rows by one or more key fields and republishes the reduced frame.",
        props: {
          transformMode: "aggregate",
          aggregateMode: "mean",
        },
      },
      {
        label: "Filter one metric family",
        summary: "Filters one broad tabular frame to the rows that match a saved field predicate.",
        props: {
          transformMode: "filter",
          filterCombineMode: "all",
          filterRules: [
            {
              field: "__name__",
              operator: "equals",
              value: "celery_task_failed_total",
            },
          ],
        },
      },
    ],
  },
  settingsComponent: TabularTransformWidgetSettings,
  component: TabularTransformWidget,
});
