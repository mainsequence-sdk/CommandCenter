import { createDataNodeWidgetSourceSettingsSchema } from "../data-node-shared/dataNodeWidgetSource";
import type { DataNodeFilterControllerContext } from "./controller";
import type { MainSequenceDataNodeFilterWidgetProps } from "./dataNodeFilterModel";

export const dataNodeFilterSettingsSchema = createDataNodeWidgetSourceSettingsSchema<
  MainSequenceDataNodeFilterWidgetProps,
  DataNodeFilterControllerContext
>({
  enableFilterWidgetSource: false,
  dataNodeCanvasQueryScope: "data_node_filter_canvas",
  dataSourceSectionDescription:
    "Pick the direct data node this widget should query when it is not bound to another widget.",
  selectionHelpText: "Choose the data node this widget should inspect directly.",
});
