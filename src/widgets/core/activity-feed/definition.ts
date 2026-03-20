import { ActivityFeedWidget } from "@/widgets/core/activity-feed/ActivityFeedWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const activityFeedWidget: WidgetDefinition<{ limit?: number }> = {
  id: "activity-feed",
  title: "Activity Feed",
  description: "Operational events, warnings and desk actions.",
  category: "Feeds",
  kind: "feed",
  source: "core",
  defaultSize: { w: 4, h: 5 },
  requiredPermissions: ["dashboard:view"],
  tags: ["ops", "alerts"],
  exampleProps: { limit: 6 },
  component: ActivityFeedWidget,
};
