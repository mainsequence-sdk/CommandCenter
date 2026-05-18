import { useCallback, useEffect, useMemo } from "react";

import { Database } from "lucide-react";

import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { useWorkspaceVariableReferenceRegistry } from "@/dashboards/DashboardWidgetDependencies";
import { useTheme } from "@/themes/ThemeProvider";
import { useIncrementalTabularConsumerBindingState } from "@/widgets/shared/incremental-tabular-consumer";
import { useResolvedTabularWidgetSourceBinding } from "@/widgets/shared/tabular-widget-source";
import type { WidgetComponentProps } from "@/widgets/types";

import { TableFrameView } from "./TableFrameView";
import {
  buildTableWidgetFrameFromRemoteData,
  normalizeTableWidgetSelectionState,
  TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
  resolveTableWidgetProps,
  resolveTableWidgetPropsWithFrame,
  resolveTableWidgetSelectionKeyFields,
  resolveTableWidgetSourceDataset,
  type TableWidgetSelectionMode,
  withTableWidgetSelectionRuntimeState,
  type TableWidgetSelectionState,
  type TableWidgetProps,
} from "./tableModel";

type Props = WidgetComponentProps<TableWidgetProps>;

function summarizeConditionalRulesForDebug(
  rules: Array<{ columnKey: string; operator: string; value?: number; tone?: string; backgroundColor?: string }>,
  columnKey: string,
) {
  return rules
    .filter((rule) => rule.columnKey === columnKey)
    .map((rule) => `${rule.operator}:${rule.value ?? ""}:${rule.tone ?? rule.backgroundColor ?? ""}`)
    .join(" | ");
}

function buildTableFormatResolutionDebugRows(input: {
  remoteFrame: ReturnType<typeof buildTableWidgetFrameFromRemoteData>;
  resolvedProps: ReturnType<typeof resolveTableWidgetPropsWithFrame>;
}) {
  const sourceSchemaByKey = new Map(
    input.remoteFrame.schemaFallback.map((column) => [column.key, column] as const),
  );
  const resolvedSchemaByKey = new Map(
    input.resolvedProps.schema.map((column) => [column.key, column] as const),
  );
  const sourceOverrides = input.remoteFrame.sourceColumnOverrides ?? {};
  const resolvedOverrides = input.resolvedProps.columnOverrides ?? {};

  return input.resolvedProps.columns.map((columnKey) => {
    const sourceSchema = sourceSchemaByKey.get(columnKey);
    const resolvedSchema = resolvedSchemaByKey.get(columnKey);
    const sourceOverride = sourceOverrides[columnKey];
    const resolvedOverride = resolvedOverrides[columnKey];

    return {
      columnId: columnKey,
      sourceFormat: sourceSchema?.format ?? null,
      sourceGaugeMode: sourceOverride?.gaugeMode ?? null,
      sourceHeatmap: sourceOverride?.heatmap ?? null,
      sourceGradientMode: sourceOverride?.gradientMode ?? null,
      sourceRuleSummary: summarizeConditionalRulesForDebug(
        input.remoteFrame.sourceConditionalRules ?? [],
        columnKey,
      ),
      resolvedFormat: resolvedSchema?.format ?? null,
      resolvedGaugeMode: resolvedOverride?.gaugeMode ?? null,
      resolvedHeatmap: resolvedOverride?.heatmap ?? null,
      resolvedGradientMode: resolvedOverride?.gradientMode ?? null,
      resolvedRuleSummary: summarizeConditionalRulesForDebug(
        input.resolvedProps.conditionalRules ?? [],
        columnKey,
      ),
    };
  });
}

function resolveImplicitSelectionMode(
  outputIds: Set<string>,
): TableWidgetSelectionMode {
  if (outputIds.has(TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID)) {
    return "multi-row";
  }

  if (outputIds.has(TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID)) {
    return "single-row";
  }

  if (
    outputIds.has(TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID) ||
    outputIds.has(TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID)
  ) {
    return "cell";
  }

  return "none";
}

function TableWidgetSourceState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
        <Database className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function TableWidget({
  props,
  resolvedInputs,
  instanceId,
  runtimeState,
  onRuntimeStateChange,
}: Props) {
  const { resolvedTokens, tightness } = useTheme();
  const variableRegistry = useWorkspaceVariableReferenceRegistry();
  const normalizedProps = useMemo(
    () => resolveTableWidgetProps(props),
    [props],
  );
  const isManualTableMode = normalizedProps.tableSourceMode === "manual";
  const sourceBinding = useResolvedTabularWidgetSourceBinding({
    props: normalizedProps as unknown as TableWidgetProps,
    currentWidgetInstanceId: instanceId,
  });
  const incrementalBinding = useIncrementalTabularConsumerBindingState({
    instanceId,
    onRuntimeStateChange,
    resolvedInputs,
    runtimeState,
  });
  const sourceConsumerState =
    !isManualTableMode && incrementalBinding.active
      ? incrementalBinding.consumerState
      : sourceBinding.consumerState;

  useResolveWidgetUpstream(instanceId, {
    enabled:
      !isManualTableMode &&
      (incrementalBinding.active
        ? incrementalBinding.requiresUpstreamResolution
        : sourceBinding.requiresUpstreamResolution),
  });

  const resolvedInputDataset = useMemo(
    () =>
      !isManualTableMode
        ? sourceConsumerState.dataset
        : resolveTableWidgetSourceDataset(resolvedInputs, runtimeState),
    [isManualTableMode, resolvedInputs, runtimeState, sourceConsumerState.dataset],
  );
  const sourceColumns = resolvedInputDataset?.columns ?? [];
  const sourceRows = resolvedInputDataset?.rows ?? [];
  const remoteFrame = useMemo(
    () =>
      buildTableWidgetFrameFromRemoteData(
        undefined,
        sourceRows,
        sourceColumns,
        resolvedInputDataset?.fields ?? [],
        resolvedInputDataset?.meta,
      ),
    [resolvedInputDataset?.fields, resolvedInputDataset?.meta, sourceColumns, sourceRows],
  );
  const resolvedProps = useMemo(
    () => resolveTableWidgetPropsWithFrame(props, remoteFrame),
    [props, remoteFrame],
  );
  useEffect(() => {
    if (!import.meta.env.DEV || isManualTableMode) {
      return;
    }

    const formatResolutionRows = buildTableFormatResolutionDebugRows({
      remoteFrame,
      resolvedProps,
    });

    console.groupCollapsed("[table:format-resolution]", instanceId ?? "no-instance");
    console.log("sourceConsumerState", sourceConsumerState);
    console.log("resolvedInputDataset", resolvedInputDataset);
    console.log("remoteFrame", remoteFrame);
    console.log("resolvedTableProps", {
      columnOverrides: resolvedProps.columnOverrides,
      conditionalRules: resolvedProps.conditionalRules,
      schema: resolvedProps.schema,
    });
    console.table(formatResolutionRows);
    console.groupEnd();
  }, [
    instanceId,
    isManualTableMode,
    remoteFrame,
    resolvedInputDataset,
    resolvedProps,
    sourceConsumerState,
  ]);
  const selectionKeyFields = useMemo(
    () => resolveTableWidgetSelectionKeyFields(resolvedProps, resolvedInputDataset),
    [resolvedInputDataset, resolvedProps],
  );
  const selectionState = useMemo(
    () => normalizeTableWidgetSelectionState(runtimeState),
    [runtimeState],
  );
  const implicitSelectionMode = useMemo(() => {
    if (
      !instanceId ||
      !normalizedProps.publishSelectionOutputs ||
      normalizedProps.selectionMode !== "none"
    ) {
      return "none";
    }

    const referencedOutputIds = new Set(
      (variableRegistry?.bySourceWidgetId.get(instanceId) ?? []).flatMap((entry) =>
        entry?.key.sourceOutputId ? [entry.key.sourceOutputId] : [],
      ),
    );

    return resolveImplicitSelectionMode(referencedOutputIds);
  }, [
    instanceId,
    normalizedProps.publishSelectionOutputs,
    normalizedProps.selectionMode,
    variableRegistry,
  ]);
  const effectiveSelectionMode =
    normalizedProps.selectionMode !== "none"
      ? normalizedProps.selectionMode
      : implicitSelectionMode;

  const handleSelectionChange = useCallback(
    (selection: TableWidgetSelectionState) => {
      if (!onRuntimeStateChange) {
        return;
      }

      onRuntimeStateChange(
        withTableWidgetSelectionRuntimeState(runtimeState, {
          ...selection,
          implicitMode:
            normalizedProps.selectionMode === "none" && effectiveSelectionMode !== "none",
        }),
      );
    },
    [
      effectiveSelectionMode,
      instanceId,
      normalizedProps.publishSelectionOutputs,
      normalizedProps.selectionMode,
      onRuntimeStateChange,
      resolvedProps.selectionMode,
      runtimeState,
    ],
  );
  const dataErrorMessage =
    !isManualTableMode && sourceConsumerState.kind === "error"
      ? sourceConsumerState.error ?? resolvedInputDataset?.error ?? "The bound source failed to load rows."
      : null;
  const isDataLoading =
    !isManualTableMode &&
    sourceConsumerState.kind === "loading";

  if (!isManualTableMode && sourceConsumerState.kind === "unbound") {
    return (
      <TableWidgetSourceState
        title="Select a dataset source"
        description="Open widget settings and use the Bindings tab to connect this table to a tabular source."
      />
    );
  }

  if (!isManualTableMode && sourceConsumerState.kind === "missing-source") {
    return (
      <TableWidgetSourceState
        title="Bound source is missing"
        description="Rebind this table to a source widget because the saved source no longer exists in this workspace."
      />
    );
  }

  if (!isManualTableMode && sourceConsumerState.kind === "missing-output") {
    return (
      <TableWidgetSourceState
        title="Bound output is missing"
        description="The selected source widget no longer publishes the output this table was bound to."
      />
    );
  }

  if (!isManualTableMode && sourceConsumerState.kind === "contract-mismatch") {
    return (
      <TableWidgetSourceState
        title="Incompatible bound dataset"
        description="Bind this table to a widget output that publishes a canonical tabular frame."
      />
    );
  }

  if (!isManualTableMode && sourceConsumerState.kind === "awaiting-upstream") {
    return (
      <TableWidgetSourceState
        title="Resolving upstream source"
        description="Refreshing the bound source widget so this table can load its dataset."
      />
    );
  }

  if (
    !isManualTableMode &&
    (sourceConsumerState.kind === "transform-invalid" ||
      sourceConsumerState.kind === "self-reference-blocked")
  ) {
    return (
      <TableWidgetSourceState
        title="Source binding is invalid"
        description="Fix the table binding before this widget can render the published dataset."
      />
    );
  }

  if (isManualTableMode && resolvedProps.columns.length === 0) {
    return (
      <TableWidgetSourceState
        title="Add manual table columns"
        description="Open widget settings and add columns or paste rows into the manual table editor."
      />
    );
  }

  return (
    <TableFrameView
      debugInstanceId={instanceId}
      dataErrorMessage={dataErrorMessage}
      isDataLoading={isDataLoading}
      resolvedProps={resolvedProps}
      resolvedTokens={resolvedTokens}
      showColumnFilters={resolvedProps.showColumnFilters}
      selectionKeyFields={selectionKeyFields}
      selectionMode={effectiveSelectionMode}
      selectionState={selectionState}
      tightness={tightness}
      onSelectionChange={handleSelectionChange}
    />
  );
}
