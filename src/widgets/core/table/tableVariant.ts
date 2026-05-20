import type { Module } from "ag-grid-community";

export type TableWidgetEdition = "community" | "pro";

export interface TableWidgetEditionCapabilities {
  enterpriseModules: boolean;
  supportsFormulas: boolean;
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
  defaultProps?: Record<string, unknown>;
  tags?: string[];
}

export const communityTableEditionCapabilities: TableWidgetEditionCapabilities = {
  enterpriseModules: false,
  supportsFormulas: false,
};

export const proTableEditionCapabilities: TableWidgetEditionCapabilities = {
  enterpriseModules: true,
  supportsFormulas: true,
};
