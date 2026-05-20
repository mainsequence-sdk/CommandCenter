import { buildTableWidgetDefinition } from "./definition.shared";
import { proTableSharedOptions, withProTableDefaultProps } from "./proTableOptions";

export const proTableWidget = buildTableWidgetDefinition({
  widgetId: "pro-table",
  widgetVersion: "1.0.0",
  title: proTableSharedOptions.editionLabel,
  edition: "pro",
  capabilities: proTableSharedOptions.capabilities,
  defaultProps: withProTableDefaultProps(undefined),
  gridModules: proTableSharedOptions.gridModules,
  usageGuidanceSectionId: "pro-table",
  tags: ["pro", "enterprise"],
});
