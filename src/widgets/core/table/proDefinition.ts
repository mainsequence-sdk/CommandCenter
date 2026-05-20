import { enterpriseAgGridModules } from "@/widgets/extensions/ag-grid/enterprise-modules";

import { buildTableWidgetDefinition } from "./definition.shared";

export const proTableWidget = buildTableWidgetDefinition({
  widgetId: "pro-table",
  widgetVersion: "1.0.0",
  title: "Pro Table",
  edition: "pro",
  capabilities: {
    enterpriseModules: true,
  },
  gridModules: enterpriseAgGridModules,
  usageGuidanceSectionId: "pro-table",
  tags: ["pro", "enterprise"],
});
