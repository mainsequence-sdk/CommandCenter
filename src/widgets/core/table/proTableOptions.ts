import { enterpriseAgGridModules } from "@/widgets/extensions/ag-grid/enterprise-modules";

import type { TableWidgetProps } from "./tableModel";
import { proTableEditionCapabilities } from "./tableVariant";

export const proTableEditionLabel = "Pro Table";

export const proTableSharedOptions = {
  capabilities: proTableEditionCapabilities,
  editionLabel: proTableEditionLabel,
  enterpriseModules: true,
  gridModules: enterpriseAgGridModules,
} as const;

export function withProTableDefaultProps(
  props: Partial<TableWidgetProps> | undefined,
): Partial<TableWidgetProps> {
  return {
    ...props,
    formulasEnabled: props?.formulasEnabled ?? true,
  };
}
