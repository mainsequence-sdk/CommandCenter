import { createDataNodeWidgetSourceSettingsSchema } from "../data-node-shared/dataNodeWidgetSource";
import type { DataNodeFilterControllerContext } from "./controller";
import type { MainSequenceDataNodeFilterWidgetProps } from "./dataNodeFilterModel";

export const dataNodeFilterSettingsSchema = createDataNodeWidgetSourceSettingsSchema<
  MainSequenceDataNodeFilterWidgetProps,
  DataNodeFilterControllerContext
>({
  enableFilterWidgetSource: false,
  enableManualSource: true,
  dataNodeCanvasQueryScope: "data_node_filter_canvas",
  dataSourceSectionDescription:
    "Pick the direct data node this widget should query, or switch to Manual table to author rows locally.",
  selectionHelpText: "Choose the data node this widget should inspect directly.",
});
