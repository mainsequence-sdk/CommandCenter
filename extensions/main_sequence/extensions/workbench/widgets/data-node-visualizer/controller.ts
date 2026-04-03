import { useMemo } from "react";

import type { WidgetController } from "@/widgets/types";

import { type PickerOption } from "../../../../common/components/PickerField";
import {
  formatDataNodeFieldMetadata,
  type DataNodeFieldOption,
} from "../data-node-shared/dataNodeShared";
import {
  buildDataNodeVisualizerGroupValueOptions,
  buildDataNodeVisualizerFieldOptionsFromRuntime,
  normalizeDataNodeVisualizerProps,
  resolveDataNodeVisualizerConfig,
  type MainSequenceDataNodeVisualizerWidgetProps,
} from "./dataNodeVisualizerModel";
import {
  useDataNodeWidgetSourceControllerContext,
  type DataNodeWidgetSourceControllerContext,
} from "../data-node-shared/dataNodeWidgetSource";

export interface DataNodeVisualizerControllerContext
  extends DataNodeWidgetSourceControllerContext<ReturnType<typeof resolveDataNodeVisualizerConfig>> {
  groupValueOptions: PickerOption[];
  xAxisOptions: PickerOption[];
  yAxisOptions: PickerOption[];
  groupOptions: PickerOption[];
}

function toPickerOption(option: DataNodeFieldOption) {
  const metadata = formatDataNodeFieldMetadata(option);

  return {
    value: option.key,
    label: option.label ?? option.key,
    description: metadata.join(" • ") || undefined,
    keywords: [option.key, option.label ?? option.key, option.nativeType ?? "", option.description ?? ""],
  } satisfies PickerOption;
}

export function useDataNodeVisualizerControllerContext({
  props,
  instanceId,
}: {
  props: MainSequenceDataNodeVisualizerWidgetProps;
  instanceId?: string;
}): DataNodeVisualizerControllerContext {
  const normalizedProps = useMemo(
    () => normalizeDataNodeVisualizerProps(props),
    [props],
  );
  const sourceContext = useDataNodeWidgetSourceControllerContext({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
    queryKeyScope: "data_node_visualizer",
    resolveConfig: resolveDataNodeVisualizerConfig,
  });
  const linkedDataset = sourceContext.resolvedSourceDataset;
  const runtimeFieldOptions = useMemo(
    () => buildDataNodeVisualizerFieldOptionsFromRuntime(linkedDataset),
    [linkedDataset],
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
  const groupValueOptions = useMemo<PickerOption[]>(
    () => buildDataNodeVisualizerGroupValueOptions(linkedDataset?.rows ?? [], resolvedConfig),
    [linkedDataset?.rows, resolvedConfig],
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
    groupValueOptions,
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
  useContext: ({ props, instanceId }) =>
    useDataNodeVisualizerControllerContext({ props, instanceId }),
};
