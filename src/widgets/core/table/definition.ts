import { communityAgGridModules } from "@/widgets/extensions/ag-grid/community-modules";
import { CORE_TABLE_WIDGET_ID } from "@/widgets/widget-type-normalization";

import { buildTableWidgetDefinition } from "./definition.shared";
import { communityTableEditionCapabilities } from "./tableVariant";

export const tableWidget = buildTableWidgetDefinition({
  widgetId: CORE_TABLE_WIDGET_ID,
  widgetVersion: "3.6.2",
  title: "Table",
  edition: "community",
  capabilities: communityTableEditionCapabilities,
  gridModules: communityAgGridModules,
  usageGuidanceSectionId: "table",
  tags: ["community"],
});
