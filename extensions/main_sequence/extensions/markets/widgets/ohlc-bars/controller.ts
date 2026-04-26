import { useMemo } from "react";

import type { WidgetController } from "@/widgets/types";

import { type PickerOption } from "../../../../common/components/PickerField";
import {
  formatDataNodeFieldMetadata,
  type DataNodeFieldOption,
} from "../../../workbench/widgets/data-node-shared/dataNodeShared";
import {
  useDataNodeWidgetSourceControllerContext,
  type DataNodeWidgetSourceControllerContext,
} from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import {
  buildOhlcBarsFieldOptionsFromRuntime,
  normalizeOhlcBarsProps,
  resolveOhlcBarsConfig,
  type MainSequenceOhlcBarsWidgetProps,
} from "./ohlcBarsModel";

export interface OhlcBarsControllerContext
  extends DataNodeWidgetSourceControllerContext<ReturnType<typeof resolveOhlcBarsConfig>> {
  closeFieldOptions: PickerOption[];
  highFieldOptions: PickerOption[];
  lowFieldOptions: PickerOption[];
  openFieldOptions: PickerOption[];
  timeFieldOptions: PickerOption[];
  volumeFieldOptions: PickerOption[];
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

function fieldPickerOptions(fieldPickerOptions: PickerOption[], label: string, description: string) {
  return [
    {
      value: "",
      label,
      description,
    },
    ...fieldPickerOptions,
  ];
}

export function useOhlcBarsControllerContext({
  props,
  instanceId,
}: {
  props: MainSequenceOhlcBarsWidgetProps;
  instanceId?: string;
}): OhlcBarsControllerContext {
  const normalizedProps = useMemo(
    () => normalizeOhlcBarsProps(props),
    [props],
  );
  const sourceContext = useDataNodeWidgetSourceControllerContext({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
    queryKeyScope: "ohlc_bars",
    resolveConfig: resolveOhlcBarsConfig,
  });
  const linkedDataset = sourceContext.resolvedSourceDataset;
  const runtimeFieldOptions = useMemo(
    () => buildOhlcBarsFieldOptionsFromRuntime(linkedDataset),
    [linkedDataset],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveOhlcBarsConfig(
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
  const pickerOptions = useMemo<PickerOption[]>(
    () => resolvedConfig.availableFields.map(toPickerOption),
    [resolvedConfig.availableFields],
  );

  return {
    ...sourceContext,
    closeFieldOptions: fieldPickerOptions(pickerOptions, "Auto", "Try to infer the close price field."),
    fieldPickerOptions: pickerOptions,
    highFieldOptions: fieldPickerOptions(pickerOptions, "Auto", "Try to infer the high price field."),
    lowFieldOptions: fieldPickerOptions(pickerOptions, "Auto", "Try to infer the low price field."),
    openFieldOptions: fieldPickerOptions(pickerOptions, "Auto", "Try to infer the open price field."),
    resolvedConfig,
    timeFieldOptions: fieldPickerOptions(pickerOptions, "Auto", "Try to infer the timestamp or date field."),
    volumeFieldOptions: fieldPickerOptions(pickerOptions, "No volume", "Do not render a volume pane."),
  };
}

export const mainSequenceOhlcBarsWidgetController: WidgetController<
  MainSequenceOhlcBarsWidgetProps,
  OhlcBarsControllerContext
> = {
  normalizeProps: (props) => normalizeOhlcBarsProps(props),
  useContext: ({ props, instanceId }) =>
    useOhlcBarsControllerContext({ props, instanceId }),
};
