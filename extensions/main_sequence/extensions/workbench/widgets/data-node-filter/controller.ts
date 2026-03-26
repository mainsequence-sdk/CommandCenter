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

export interface DataNodeFilterControllerContext
  extends DataNodeWidgetSourceControllerContext<ReturnType<typeof resolveDataNodeFilterConfig>> {}

export function useDataNodeFilterControllerContext({
  props,
}: {
  props: MainSequenceDataNodeFilterWidgetProps;
}): DataNodeFilterControllerContext {
  return useDataNodeWidgetSourceControllerContext({
    props,
    queryKeyScope: "data_node_filter",
    resolveConfig: resolveDataNodeFilterConfig,
  });
}

export const dataNodeFilterWidgetController: WidgetController<
  MainSequenceDataNodeFilterWidgetProps,
  DataNodeFilterControllerContext
> = {
  normalizeProps: (props) => normalizeDataNodeFilterProps(props),
  useContext: ({ props }) => useDataNodeFilterControllerContext({ props }),
};
