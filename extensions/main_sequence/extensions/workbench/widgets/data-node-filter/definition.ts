import { Database } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { dataNodeFilterWidgetController } from "./controller";
import { MainSequenceDataNodeFilterWidget } from "./MainSequenceDataNodeFilterWidget";
import { MainSequenceDataNodeFilterWidgetSettings } from "./MainSequenceDataNodeFilterWidgetSettings";
import { DataNodeRailSummary } from "./DataNodeRailSummary";
import type { MainSequenceDataNodeFilterWidgetProps } from "./dataNodeFilterModel";
import { dataNodeFilterSettingsSchema } from "./schema";

export const mainSequenceDataNodeFilterWidget = defineWidget<MainSequenceDataNodeFilterWidgetProps>({
  id: "main-sequence-data-node",
  title: "Data Node",
  description: "Stores a reusable Main Sequence dataset node, with a settings-only table preview.",
  category: "DataNodes",
  kind: "custom",
  source: "main_sequence_workbench",
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "filter", "preview", "table"],
  exampleProps: {
    chromeMode: "minimal",
    dateRangeMode: "dashboard",
    showHeader: false,
  },
  mockProps: {
    chromeMode: "minimal",
    dataNodeId: 1084,
    dateRangeMode: "dashboard",
    showHeader: false,
  },
  defaultPresentation: {
    placementMode: "sidebar",
  },
  railIcon: Database,
  railSummaryComponent: DataNodeRailSummary,
  schema: dataNodeFilterSettingsSchema,
  controller: dataNodeFilterWidgetController,
  settingsComponent: MainSequenceDataNodeFilterWidgetSettings,
  component: MainSequenceDataNodeFilterWidget,
});
