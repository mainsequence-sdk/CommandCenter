import { useMemo } from "react";

import type { ResolvedWidgetInputs, WidgetController } from "@/widgets/types";
import { useRuntimeDataStore } from "@/widgets/shared/runtime-data-store";

import { type PickerOption } from "@/widgets/shared/picker-field";
import {
  formatTabularFieldMetadata,
  type TabularFieldOption,
} from "@/widgets/shared/tabular-widget-source";
import {
  buildGraphFieldOptionsFromRuntime,
  normalizeGraphProps,
  resolveGraphConfig,
  resolveGraphDatasetFrame,
  type GraphWidgetProps,
} from "./graphModel";
import {
  useTabularWidgetSourceControllerContext,
  type TabularWidgetSourceControllerContext,
} from "@/widgets/shared/tabular-widget-source";
import { resolveIncrementalTabularBindingSnapshot } from "@/widgets/shared/incremental-tabular-consumer";

const GRAPH_LIVE_UPDATE_MERGE_KEY_FIELDS: string[] = [];

export interface GraphControllerContext
  extends TabularWidgetSourceControllerContext<ReturnType<typeof resolveGraphConfig>> {
  xAxisOptions: PickerOption[];
  yAxisOptions: PickerOption[];
  groupOptions: PickerOption[];
}

function hasGraphFieldHints(
  dataset: Parameters<typeof buildGraphFieldOptionsFromRuntime>[0],
) {
  return (
    (dataset?.fields?.length ?? 0) > 0 ||
    (dataset?.columns?.length ?? 0) > 0 ||
    (dataset?.rows?.some((row) => Object.keys(row).length > 0) ?? false)
  );
}

function mergeGraphFieldOptions(optionGroups: TabularFieldOption[][]) {
  const merged = new Map<string, TabularFieldOption>();

  optionGroups.forEach((options) => {
    options.forEach((option) => {
      if (!merged.has(option.key)) {
        merged.set(option.key, option);
      }
    });
  });

  return Array.from(merged.values());
}

function toPickerOption(option: TabularFieldOption) {
  const metadata = formatTabularFieldMetadata(option);

  return {
    value: option.key,
    label: option.label ?? option.key,
    description: metadata.join(" • ") || undefined,
    keywords: [option.key, option.label ?? option.key, option.nativeType ?? "", option.description ?? ""],
  } satisfies PickerOption;
}

export function useGraphControllerContext({
  props,
  instanceId,
  runtimeState,
  resolvedInputs,
}: {
  props: GraphWidgetProps;
  instanceId?: string;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
}): GraphControllerContext {
  const runtimeDataStore = useRuntimeDataStore();
  const normalizedProps = useMemo(
    () => normalizeGraphProps(props),
    [props],
  );
  const sourceContext = useTabularWidgetSourceControllerContext({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
    queryKeyScope: "data_node_visualizer",
    resolvedInputs,
    resolveConfig: resolveGraphConfig,
  });
  const incrementalBinding = useMemo(
    () =>
      resolveIncrementalTabularBindingSnapshot({
        liveMergeKeyFields: GRAPH_LIVE_UPDATE_MERGE_KEY_FIELDS,
        resolvedInputs,
        runtimeState,
        runtimeDataStore,
      }),
    [resolvedInputs, runtimeDataStore, runtimeState],
  );
  const linkedBaseDataset = useMemo(
    () =>
      resolveGraphDatasetFrame(
        incrementalBinding.active
          ? incrementalBinding.dataset
          : sourceContext.resolvedSourceDataset,
      ),
    [
      incrementalBinding.active,
      incrementalBinding.dataset,
      sourceContext.resolvedSourceDataset,
    ],
  );
  const linkedDeltaDataset = useMemo(
    () =>
      resolveGraphDatasetFrame(
        incrementalBinding.active
          ? incrementalBinding.deltaDataset
          : sourceContext.resolvedSourceDeltaFrame,
      ),
    [
      incrementalBinding.active,
      incrementalBinding.deltaDataset,
      sourceContext.resolvedSourceDeltaFrame,
    ],
  );
  const linkedDataset = useMemo(
    () =>
      hasGraphFieldHints(linkedBaseDataset)
        ? linkedBaseDataset
        : linkedDeltaDataset ?? linkedBaseDataset,
    [
      linkedBaseDataset,
      linkedDeltaDataset,
    ],
  );
  const runtimeFieldOptions = useMemo(
    () =>
      mergeGraphFieldOptions([
        buildGraphFieldOptionsFromRuntime(linkedBaseDataset),
        buildGraphFieldOptionsFromRuntime(linkedDeltaDataset),
      ]),
    [linkedBaseDataset, linkedDeltaDataset],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveGraphConfig(
        {
          ...normalizedProps,
          ...sourceContext.resolvedSourceProps,
        },
        sourceContext.selectedTabularSourceDetailQuery.data,
        runtimeFieldOptions.length > 0 ? runtimeFieldOptions : undefined,
      ),
    [
      normalizedProps,
      runtimeFieldOptions,
      sourceContext.resolvedSourceProps,
      sourceContext.selectedTabularSourceDetailQuery.data,
    ],
  );
  const fieldPickerOptions = useMemo(
    () => resolvedConfig.availableFields.map(toPickerOption),
    [resolvedConfig.availableFields],
  );
  const xAxisOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Not set",
        description: "Select the field to use for the X axis.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const yAxisOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Not set",
        description: "Select the field to use for the Y axis.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const groupOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "No grouping",
        description: "Keep all rows in the same series.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );

  return {
    ...sourceContext,
    consumerState: incrementalBinding.active
      ? incrementalBinding.consumerState
      : sourceContext.consumerState,
    isAwaitingBoundSourceValue: incrementalBinding.active
      ? incrementalBinding.consumerState.kind === "awaiting-upstream"
      : sourceContext.isAwaitingBoundSourceValue,
    requiresUpstreamResolution: incrementalBinding.active
      ? incrementalBinding.requiresUpstreamResolution
      : sourceContext.requiresUpstreamResolution,
    resolvedSourceDataset: linkedDataset,
    resolvedSourceDeltaFrame: linkedDeltaDataset,
    fieldPickerOptions,
    resolvedConfig,
    xAxisOptions,
    yAxisOptions,
    groupOptions,
  };
}

export const graphWidgetController: WidgetController<
  GraphWidgetProps,
  GraphControllerContext
> = {
  normalizeProps: (props) => normalizeGraphProps(props),
  useContext: ({ props, instanceId, resolvedInputs, runtimeState }) =>
    useGraphControllerContext({ props, instanceId, resolvedInputs, runtimeState }),
};
