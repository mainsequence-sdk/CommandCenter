import { useMemo } from "react";

import type { WidgetController } from "@/widgets/types";

import { type PickerOption } from "../../../../common/components/PickerField";
import {
  useDataNodeWidgetSourceControllerContext,
  type DataNodeWidgetSourceControllerContext,
} from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import { normalizeDataNodeFilterRuntimeState } from "../../../workbench/widgets/data-node-filter/dataNodeFilterModel";
import {
  buildZeroCurveValueOptions,
  formatZeroCurveValue,
  normalizeZeroCurveProps,
  resolveZeroCurveConfig,
  type MainSequenceZeroCurveWidgetProps,
} from "./zeroCurveModel";

export interface ZeroCurveControllerContext
  extends DataNodeWidgetSourceControllerContext<ReturnType<typeof resolveZeroCurveConfig>> {
  curveValueOptions: PickerOption[];
}

export function useZeroCurveControllerContext({
  props,
  instanceId,
}: {
  props: MainSequenceZeroCurveWidgetProps;
  instanceId?: string;
}): ZeroCurveControllerContext {
  const normalizedProps = useMemo(
    () => normalizeZeroCurveProps(props),
    [props],
  );
  const sourceContext = useDataNodeWidgetSourceControllerContext({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
    queryKeyScope: "zero_curve",
    resolveConfig: resolveZeroCurveConfig,
  });
  const linkedFilterRuntime = useMemo(
    () => normalizeDataNodeFilterRuntimeState(sourceContext.referencedFilterWidget?.runtimeState),
    [sourceContext.referencedFilterWidget?.runtimeState],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveZeroCurveConfig(
        {
          ...normalizedProps,
          ...sourceContext.resolvedSourceProps,
        },
        sourceContext.selectedDataNodeDetailQuery.data,
      ),
    [
      normalizedProps,
      sourceContext.resolvedSourceProps,
      sourceContext.selectedDataNodeDetailQuery.data,
    ],
  );
  const curveValueOptions = useMemo<PickerOption[]>(
    () =>
      buildZeroCurveValueOptions(linkedFilterRuntime?.rows ?? []).map((option) => ({
        ...option,
        keywords: [option.value, option.label, formatZeroCurveValue(option.label)],
      })),
    [linkedFilterRuntime?.rows],
  );

  return {
    ...sourceContext,
    curveValueOptions,
    resolvedConfig,
  };
}

export const mainSequenceZeroCurveWidgetController: WidgetController<
  MainSequenceZeroCurveWidgetProps,
  ZeroCurveControllerContext
> = {
  normalizeProps: (props) => normalizeZeroCurveProps(props),
  useContext: ({ props, instanceId }) =>
    useZeroCurveControllerContext({ props, instanceId }),
};
