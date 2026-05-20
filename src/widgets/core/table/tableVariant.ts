import type { Module } from "ag-grid-community";

export type TableWidgetEdition = "community" | "pro";

export interface TableWidgetEditionCapabilities {
  enterpriseModules: boolean;
}

export interface TableWidgetSharedOptions {
  edition: TableWidgetEdition;
  capabilities: TableWidgetEditionCapabilities;
  gridModules: Module[];
  usageGuidanceSectionId: string;
}

export interface TableWidgetDefinitionOptions extends TableWidgetSharedOptions {
  widgetId: string;
  title: string;
  widgetVersion: string;
  tags?: string[];
}
