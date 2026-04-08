import type { WidgetDefinition } from "@/widgets/types";

import { ActivityFeedWidget } from "./ActivityFeedWidget";

export const activityFeedWidget: WidgetDefinition<{ limit?: number }> = {
  id: "activity-feed",
  title: "Activity Feed",
  description: "Operational events, warnings, and desk actions for demo dashboards.",
  category: "Feeds",
  kind: "feed",
  source: "demo",
  defaultSize: { w: 4, h: 5 },
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["ops", "alerts", "demo"],
  exampleProps: { limit: 6 },
  component: ActivityFeedWidget,
};
