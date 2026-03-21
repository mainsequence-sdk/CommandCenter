import { OrderBookDepthWidget } from "@/widgets/extensions/order-book/OrderBookDepthWidget";
import { OrderBookWidget } from "@/widgets/extensions/order-book/OrderBookWidget";
import type { WidgetDefinition } from "@/widgets/types";

export const orderBookWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "order-book",
  title: "Order Book",
  description: "Level II style side-by-side bid/ask widget shipped by an extension.",
  category: "Execution",
  kind: "custom",
  source: "flow-lab",
  defaultSize: { w: 4, h: 5 },
  requiredPermissions: ["orders:read"],
  tags: ["execution", "extension"],
  exampleProps: { symbol: "TSLA" },
  component: OrderBookWidget,
};

export const orderBookDepthWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "order-book-depth",
  title: "Order Book Depth",
  description:
    "Depth-oriented Level II widget that overlays numeric size with filled bid/ask distribution bars.",
  category: "Execution",
  kind: "custom",
  source: "flow-lab",
  defaultSize: { w: 4, h: 5 },
  requiredPermissions: ["orders:read"],
  tags: ["execution", "extension", "depth"],
  exampleProps: { symbol: "TSLA" },
  component: OrderBookDepthWidget,
};
