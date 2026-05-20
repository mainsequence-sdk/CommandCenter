import { communityAgGridModules } from "@/widgets/extensions/ag-grid/community-modules";

import { buildTableWidgetDefinition } from "./definition.shared";

export const tableWidget = buildTableWidgetDefinition({
  widgetId: "table",
  widgetVersion: "3.5.0",
  title: "Table",
  edition: "community",
  capabilities: {
    enterpriseModules: false,
  },
  gridModules: communityAgGridModules,
  usageGuidanceSectionId: "table",
  tags: ["community"],
});
