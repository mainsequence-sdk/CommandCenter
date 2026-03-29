import { NewsFeedWidget } from "@/widgets/core/news-feed/NewsFeedWidget";
import { defineWidget } from "@/widgets/types";

export const newsFeedWidget = defineWidget<{ limit?: number }>({
  id: "news-feed",
  title: "News Feed",
  description: "Compact market news list for event-driven dashboards.",
  category: "Feeds",
  kind: "feed",
  source: "core",
  requiredPermissions: ["news:read"],
  tags: ["feed", "events"],
  exampleProps: { limit: 6 },
  component: NewsFeedWidget,
});
