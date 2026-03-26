import { createDataNodeWidgetSourceSettingsSchema } from "../data-node-shared/dataNodeWidgetSource";
import type { DataNodeFilterControllerContext } from "./controller";
import type { MainSequenceDataNodeFilterWidgetProps } from "./dataNodeFilterModel";

export const dataNodeFilterSettingsSchema = createDataNodeWidgetSourceSettingsSchema<
  MainSequenceDataNodeFilterWidgetProps,
  DataNodeFilterControllerContext
>({
  enableFilterWidgetSource: true,
  dataNodeCanvasQueryScope: "data_node_filter_canvas",
  dataSourceSectionDescription:
    "Pick a direct data node or another Data Node widget to use as the input dataset.",
  selectionHelpText: "Choose the table you want to inspect.",
});
