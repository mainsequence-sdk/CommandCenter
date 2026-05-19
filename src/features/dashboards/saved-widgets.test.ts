import { describe, expect, it } from "vitest";

import type { DashboardDefinition } from "@/dashboards/types";
import { POSITION_DETAIL_WIDGET_ID } from "@/widgets/widget-type-normalization";

import { appendSavedWidgetInstanceToDashboard } from "./saved-widgets";
import type { SavedWidgetInstanceRecord } from "./saved-widgets-api";

describe("saved widget import migration", () => {
  it("rewrites legacy portfolio weights widget ids to position detail on import", () => {
    const dashboard: DashboardDefinition = {
      id: "workspace-1",
      title: "Workspace",
      description: "Saved widget import migration",
      source: "test",
      widgets: [],
    };

    const savedWidget: SavedWidgetInstanceRecord = {
      id: "saved-widget-1",
      title: "Legacy Position Widget",
      description: "",
      labels: [],
      source: "test",
      category: "Custom",
      widgetTypeId: "portfolio-weights-table",
      instanceTitle: "Legacy Position Widget",
      updatedAt: null,
      schemaVersion: 1,
      props: {
        sourceType: "target_position",
      },
      layout: {
        cols: 8,
        rows: 6,
      },
      companions: [],
      requiredPermissions: [],
    };

    const updated = appendSavedWidgetInstanceToDashboard(dashboard, savedWidget);
    const imported = updated.widgets[0];

    expect(imported?.widgetId).toBe(POSITION_DETAIL_WIDGET_ID);
  });
});
