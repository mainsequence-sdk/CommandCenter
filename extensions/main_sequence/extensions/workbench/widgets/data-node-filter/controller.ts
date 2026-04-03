import { useMemo } from "react";

import type { WidgetController } from "@/widgets/types";

import {
  normalizeDataNodeFilterProps,
  resolveDataNodeFilterConfig,
  type MainSequenceDataNodeFilterWidgetProps,
} from "./dataNodeFilterModel";
import {
  useDataNodeWidgetSourceControllerContext,
  type DataNodeWidgetSourceControllerContext,
} from "../data-node-shared/dataNodeWidgetSource";
import { resolveDataNodeFieldOptionsFromDataset } from "../data-node-shared/dataNodeShared";

export interface DataNodeFilterControllerContext
  extends DataNodeWidgetSourceControllerContext<ReturnType<typeof resolveDataNodeFilterConfig>> {}

export function useDataNodeFilterControllerContext({
  props,
  instanceId,
}: {
  props: MainSequenceDataNodeFilterWidgetProps;
  instanceId?: string;
}): DataNodeFilterControllerContext {
  const sourceContext = useDataNodeWidgetSourceControllerContext({
    props,
    currentWidgetInstanceId: instanceId,
    queryKeyScope: "data_node_filter",
    resolveConfig: resolveDataNodeFilterConfig,
  });
  const linkedDataset = sourceContext.resolvedSourceDataset;
  const runtimeFieldOptions = useMemo(
    () =>
      resolveDataNodeFieldOptionsFromDataset({
        columns: linkedDataset?.columns,
        fields: linkedDataset?.fields,
        rows: linkedDataset?.rows,
      }),
    [linkedDataset?.columns, linkedDataset?.fields, linkedDataset?.rows],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveDataNodeFilterConfig(
        {
          ...props,
          ...sourceContext.resolvedSourceProps,
        },
        sourceContext.selectedDataNodeDetailQuery.data,
        runtimeFieldOptions.length > 0 ? runtimeFieldOptions : undefined,
      ),
    [
      props,
      runtimeFieldOptions,
      sourceContext.resolvedSourceProps,
      sourceContext.selectedDataNodeDetailQuery.data,
    ],
  );

  return {
    ...sourceContext,
    resolvedConfig,
  };
}

export const dataNodeFilterWidgetController: WidgetController<
  MainSequenceDataNodeFilterWidgetProps,
  DataNodeFilterControllerContext
> = {
  normalizeProps: (props) => normalizeDataNodeFilterProps(props),
  useContext: ({ props, instanceId }) => useDataNodeFilterControllerContext({ props, instanceId }),
};
