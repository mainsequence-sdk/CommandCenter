import { NewsFeedWidget } from "@/widgets/core/news-feed/NewsFeedWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const newsFeedWidget: WidgetDefinition<{ limit?: number }> = {
  id: "news-feed",
  title: "News Feed",
  description: "Compact market news list for event-driven dashboards.",
  category: "Feeds",
  kind: "feed",
  source: "core",
  defaultSize: { w: 4, h: 5 },
  requiredPermissions: ["news:read"],
  tags: ["feed", "events"],
  exampleProps: { limit: 6 },
  component: NewsFeedWidget,
};
