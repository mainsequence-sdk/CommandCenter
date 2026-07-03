import { buildTableWidgetDefinition } from "./definition.shared";
import { proTableSharedOptions, withProTableDefaultProps } from "./proTableOptions";
import { CORE_PRO_TABLE_WIDGET_ID } from "@/widgets/widget-type-normalization";

export const proTableWidget = buildTableWidgetDefinition({
  widgetId: CORE_PRO_TABLE_WIDGET_ID,
  widgetVersion: "1.1.4",
  title: proTableSharedOptions.editionLabel,
  edition: "pro",
  capabilities: proTableSharedOptions.capabilities,
  defaultProps: withProTableDefaultProps(undefined),
  gridModules: proTableSharedOptions.gridModules,
  usageGuidanceSectionId: "pro-table",
  tags: ["pro", "enterprise"],
});
