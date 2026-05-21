import { useCallback, useMemo } from "react";

import { Database } from "lucide-react";

import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecutionContext";
import { useWorkspaceVariableReferenceRegistry } from "@/dashboards/DashboardWidgetDependenciesContext";
import { useTheme } from "@/themes/ThemeContext";
import { communityAgGridModules } from "@/widgets/extensions/ag-grid/community-modules";
import { useIncrementalTabularConsumerBindingState } from "@/widgets/shared/incremental-tabular-consumer";
import { useResolvedTabularWidgetSourceBinding } from "@/widgets/shared/tabular-widget-source";
import type { WidgetComponentProps } from "@/widgets/types";

import { TableFrameView } from "./TableFrameView";
import {
  buildTableWidgetFrameFromRemoteData,
  normalizeTableWidgetSelectionState,
  resolveEffectivePublishedSelectionMode,
  resolveTableWidgetProps,
  resolveTableWidgetPropsWithFrame,
  resolveTableWidgetSelectionKeyFields,
  resolveTableWidgetSourceDataset,
  withTableWidgetSelectionRuntimeState,
  type TableWidgetSelectionState,
  type TableWidgetProps,
} from "./tableModel";
import type { TableWidgetSharedOptions } from "./tableVariant";

type Props = WidgetComponentProps<TableWidgetProps>;
type TableWidgetComponentOptions = Pick<TableWidgetSharedOptions, "gridModules">;

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

function TableWidgetComponent({
  props,
  resolvedInputs,
  instanceId,
  gridModules,
  runtimeState,
  onRuntimeStateChange,
}: Props & TableWidgetComponentOptions) {
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
    liveMergeKeyMappings: normalizedProps.liveMergeKeyMappings,
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
  const selectionKeyFields = useMemo(
    () => resolveTableWidgetSelectionKeyFields(resolvedProps, resolvedInputDataset),
    [resolvedInputDataset, resolvedProps],
  );
  const selectionState = useMemo(
    () => normalizeTableWidgetSelectionState(runtimeState),
    [runtimeState],
  );
  const referencedOutputIds = useMemo(
    () =>
      new Set(
        !instanceId
          ? []
          : (variableRegistry?.bySourceWidgetId.get(instanceId) ?? []).flatMap((entry) =>
              entry?.key.sourceOutputId ? [entry.key.sourceOutputId] : [],
            ),
      ),
    [instanceId, variableRegistry],
  );
  const effectiveSelectionMode = resolveEffectivePublishedSelectionMode(
    normalizedProps,
    selectionState,
    referencedOutputIds,
  );

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
      dataErrorMessage={dataErrorMessage}
      gridModules={gridModules}
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

export function createTableWidgetComponent(options: TableWidgetComponentOptions) {
  return function TableWidgetVariant(props: Props) {
    return <TableWidgetComponent {...props} gridModules={options.gridModules} />;
  };
}

export const TableWidget = createTableWidgetComponent({
  gridModules: communityAgGridModules,
});
