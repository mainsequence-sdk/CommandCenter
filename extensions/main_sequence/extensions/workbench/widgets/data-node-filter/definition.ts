import { Database } from "lucide-react";

import type { WidgetDefinition } from "@/widgets/types";

import { dataNodeFilterWidgetController } from "./controller";
import { MainSequenceDataNodeFilterWidget } from "./MainSequenceDataNodeFilterWidget";
import { MainSequenceDataNodeFilterWidgetSettings } from "./MainSequenceDataNodeFilterWidgetSettings";
import { DataNodeRailSummary } from "./DataNodeRailSummary";
import type { MainSequenceDataNodeFilterWidgetProps } from "./dataNodeFilterModel";
import { dataNodeFilterSettingsSchema } from "./schema";

export const mainSequenceDataNodeFilterWidget: WidgetDefinition<MainSequenceDataNodeFilterWidgetProps> = {
  id: "main-sequence-data-node",
  title: "Data Node",
  description: "Stores a reusable Main Sequence dataset node, with a settings-only table preview.",
  category: "DataNodes",
  kind: "custom",
  source: "main_sequence_workbench",
  defaultSize: { w: 1, h: 1 },
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
  railIcon: Database,
  railSummaryComponent: DataNodeRailSummary,
  schema: dataNodeFilterSettingsSchema,
  controller: dataNodeFilterWidgetController,
  settingsComponent: MainSequenceDataNodeFilterWidgetSettings,
  component: MainSequenceDataNodeFilterWidget,
};
