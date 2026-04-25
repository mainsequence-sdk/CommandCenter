import { useMemo } from "react";

import type { WidgetController } from "@/widgets/types";

import { type PickerOption } from "@/widgets/shared/picker-field";
import {
  formatTabularFieldMetadata,
  type TabularFieldOption,
} from "@/widgets/shared/tabular-widget-source";
import {
  buildGraphFieldOptionsFromRuntime,
  normalizeGraphProps,
  resolveGraphConfig,
  type GraphWidgetProps,
} from "./graphModel";
import {
  useTabularWidgetSourceControllerContext,
  type TabularWidgetSourceControllerContext,
} from "@/widgets/shared/tabular-widget-source";

export interface GraphControllerContext
  extends TabularWidgetSourceControllerContext<ReturnType<typeof resolveGraphConfig>> {
  xAxisOptions: PickerOption[];
  yAxisOptions: PickerOption[];
  groupOptions: PickerOption[];
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
}: {
  props: GraphWidgetProps;
  instanceId?: string;
}): GraphControllerContext {
  const normalizedProps = useMemo(
    () => normalizeGraphProps(props),
    [props],
  );
  const sourceContext = useTabularWidgetSourceControllerContext({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
    queryKeyScope: "data_node_visualizer",
    resolveConfig: resolveGraphConfig,
  });
  const linkedDataset = useMemo(
    () => sourceContext.resolvedSourceDataset,
    [sourceContext.resolvedSourceDataset],
  );
  const runtimeFieldOptions = useMemo(
    () => buildGraphFieldOptionsFromRuntime(linkedDataset),
    [linkedDataset],
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
  useContext: ({ props, instanceId }) =>
    useGraphControllerContext({ props, instanceId }),
};
