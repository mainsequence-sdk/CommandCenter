import { useMemo } from "react";

import type { WidgetController } from "@/widgets/types";

import { type PickerOption } from "../../../../common/components/PickerField";
import {
  useDataNodeWidgetSourceControllerContext,
  type DataNodeWidgetSourceControllerContext,
} from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import { normalizeDataNodeFilterRuntimeState } from "../../../workbench/widgets/data-node-filter/dataNodeFilterModel";
import {
  buildCurvePlotCurveValueOptions,
  buildCurvePlotFieldOptionsFromRuntime,
  formatCurvePlotValue,
  normalizeCurvePlotProps,
  resolveCurvePlotConfig,
  type MainSequenceCurvePlotWidgetProps,
} from "./curvePlotModel";

export interface CurvePlotControllerContext
  extends DataNodeWidgetSourceControllerContext<ReturnType<typeof resolveCurvePlotConfig>> {
  curveFieldOptions: PickerOption[];
  curveValueOptions: PickerOption[];
  maturityFieldOptions: PickerOption[];
  valueFieldOptions: PickerOption[];
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

export function useCurvePlotControllerContext({
  props,
  instanceId,
}: {
  props: MainSequenceCurvePlotWidgetProps;
  instanceId?: string;
}): CurvePlotControllerContext {
  const normalizedProps = useMemo(
    () => normalizeCurvePlotProps(props),
    [props],
  );
  const sourceContext = useDataNodeWidgetSourceControllerContext({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
    queryKeyScope: "curve_plot",
    resolveConfig: resolveCurvePlotConfig,
  });
  const linkedFilterRuntime = useMemo(
    () => normalizeDataNodeFilterRuntimeState(sourceContext.referencedFilterWidget?.runtimeState),
    [sourceContext.referencedFilterWidget?.runtimeState],
  );
  const runtimeFieldOptions = useMemo(
    () => buildCurvePlotFieldOptionsFromRuntime(linkedFilterRuntime),
    [linkedFilterRuntime],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveCurvePlotConfig(
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
  const maturityFieldOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Auto",
        description: "Try to infer the maturity/tenor field from the dataset.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const valueFieldOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Auto",
        description: "Try to infer the yield/value field from the dataset.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const curveFieldOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "No grouping",
        description: "Render all parsed points as a single curve.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const curveValueOptions = useMemo<PickerOption[]>(
    () =>
      buildCurvePlotCurveValueOptions(linkedFilterRuntime?.rows ?? [], resolvedConfig).map((option) => ({
        ...option,
        keywords: [option.value, option.label, formatCurvePlotValue(option.label)],
      })),
    [linkedFilterRuntime?.rows, resolvedConfig],
  );

  return {
    ...sourceContext,
    curveFieldOptions,
    curveValueOptions,
    fieldPickerOptions,
    maturityFieldOptions,
    resolvedConfig,
    valueFieldOptions,
  };
}

export const mainSequenceCurvePlotWidgetController: WidgetController<
  MainSequenceCurvePlotWidgetProps,
  CurvePlotControllerContext
> = {
  normalizeProps: (props) => normalizeCurvePlotProps(props),
  useContext: ({ props, instanceId }) =>
    useCurvePlotControllerContext({ props, instanceId }),
};
