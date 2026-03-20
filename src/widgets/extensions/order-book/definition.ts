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
