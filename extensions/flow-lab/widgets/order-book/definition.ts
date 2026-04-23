import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import type { WidgetDefinition } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { OrderBookDepthWidget } from "./OrderBookDepthWidget";
import { OrderBookWidget } from "./OrderBookWidget";

export const orderBookWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "order-book",
  widgetVersion: "1.0.0",
  title: "Order Book",
  description: resolveWidgetDescription(usageGuidanceMarkdown, "order-book"),
  category: "Execution",
  kind: "custom",
  source: "flow-lab",
  defaultSize: { w: 4, h: 5 },
  requiredPermissions: ["orders:read"],
  tags: ["execution", "extension"],
  exampleProps: { symbol: "TSLA" },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Configures a simple symbol-driven extension order book widget.",
      fields: [{ id: "symbol", label: "Symbol", type: "string", source: "custom-settings" }],
    },
    io: {
      mode: "none",
      summary: "This extension widget does not expose a standardized typed IO contract.",
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown, "order-book"),
  },
  component: OrderBookWidget,
};

export const orderBookDepthWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "order-book-depth",
  widgetVersion: "1.0.0",
  title: "Order Book Depth",
  description: resolveWidgetDescription(usageGuidanceMarkdown, "order-book-depth"),
  category: "Execution",
  kind: "custom",
  source: "flow-lab",
  defaultSize: { w: 4, h: 5 },
  requiredPermissions: ["orders:read"],
  tags: ["execution", "extension", "depth"],
  exampleProps: { symbol: "TSLA" },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Configures a symbol-driven order book depth widget.",
      fields: [{ id: "symbol", label: "Symbol", type: "string", source: "custom-settings" }],
    },
    io: {
      mode: "none",
      summary: "This extension widget does not expose a standardized typed IO contract.",
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown, "order-book-depth"),
  },
  component: OrderBookDepthWidget,
};
