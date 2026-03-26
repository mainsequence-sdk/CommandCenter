import { useMemo } from "react";

import type { WidgetController } from "@/widgets/types";

import { type PickerOption } from "../../../../common/components/PickerField";
import {
  buildDataNodeVisualizerFieldOptionsFromRuntime,
  normalizeDataNodeVisualizerProps,
  resolveDataNodeVisualizerConfig,
  type MainSequenceDataNodeVisualizerWidgetProps,
} from "./dataNodeVisualizerModel";
import {
  useDataNodeWidgetSourceControllerContext,
  type DataNodeWidgetSourceControllerContext,
} from "../data-node-shared/dataNodeWidgetSource";
import { normalizeDataNodeFilterRuntimeState } from "../data-node-filter/dataNodeFilterModel";

export interface DataNodeVisualizerControllerContext
  extends DataNodeWidgetSourceControllerContext<ReturnType<typeof resolveDataNodeVisualizerConfig>> {
  xAxisOptions: PickerOption[];
  yAxisOptions: PickerOption[];
  groupOptions: PickerOption[];
}

function toPickerOption(option: {
  key: string;
  label: string;
  description?: string | null;
  dtype?: string | null;
  isTime?: boolean;
  isIndex?: boolean;
}) {
  const metadata = [
    option.dtype ?? null,
    option.isTime ? "Time" : null,
    option.isIndex ? "Index" : null,
    option.description ?? null,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return {
    value: option.key,
    label: option.label,
    description: metadata.join(" • ") || undefined,
    keywords: [option.key, option.label, option.dtype ?? "", option.description ?? ""],
  } satisfies PickerOption;
}

export function useDataNodeVisualizerControllerContext({
  props,
}: {
  props: MainSequenceDataNodeVisualizerWidgetProps;
}): DataNodeVisualizerControllerContext {
  const normalizedProps = useMemo(
    () => normalizeDataNodeVisualizerProps(props),
    [props],
  );
  const sourceContext = useDataNodeWidgetSourceControllerContext({
    props: normalizedProps,
    queryKeyScope: "data_node_visualizer",
    resolveConfig: resolveDataNodeVisualizerConfig,
  });
  const linkedFilterRuntime = useMemo(
    () => normalizeDataNodeFilterRuntimeState(sourceContext.referencedFilterWidget?.runtimeState),
    [sourceContext.referencedFilterWidget?.runtimeState],
  );
  const runtimeFieldOptions = useMemo(
    () => buildDataNodeVisualizerFieldOptionsFromRuntime(linkedFilterRuntime),
    [linkedFilterRuntime],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveDataNodeVisualizerConfig(
        {
          ...normalizedProps,
          ...sourceContext.resolvedSourceProps,
        },
        sourceContext.selectedDataNodeDetailQuery.data,
        runtimeFieldOptions.length > 0 ? runtimeFieldOptions : undefined,
      ),
    [
      normalizedProps,
      runtimeFieldOptions,
      sourceContext.resolvedSourceProps,
      sourceContext.selectedDataNodeDetailQuery.data,
    ],
  );
  const fieldPickerOptions = useMemo<PickerOption[]>(
    () => resolvedConfig.availableFields.map(toPickerOption),
    [resolvedConfig.availableFields],
  );
  const xAxisOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Auto",
        description: "Use the default time field.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const yAxisOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Auto",
        description: "Use the default value field.",
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
    fieldPickerOptions,
    resolvedConfig,
    xAxisOptions,
    yAxisOptions,
    groupOptions,
  };
}

export const dataNodeVisualizerWidgetController: WidgetController<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
> = {
  normalizeProps: (props) => normalizeDataNodeVisualizerProps(props),
  useContext: ({ props }) => useDataNodeVisualizerControllerContext({ props }),
};
