import { resolveWidgetDescription } from "@/widgets/shared/widget-description";
import type { WidgetDefinition } from "@/widgets/types";

import descriptionMarkdown from "./DESCRIPTION.md?raw";
import { OrderBookDepthWidget } from "./OrderBookDepthWidget";
import { OrderBookWidget } from "./OrderBookWidget";

export const orderBookWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "order-book",
  widgetVersion: "1.0.0",
  title: "Order Book",
  description: resolveWidgetDescription(descriptionMarkdown, "order-book"),
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
    agentHints: {
      buildPurpose: "Use this widget to show a side-by-side bid and ask order book for one symbol.",
      whenToUse: ["Use when an extension surface needs a compact order book view."],
      whenNotToUse: ["Do not use when the workflow needs typed bindings or shared execution."],
      authoringSteps: ["Set the target symbol."],
      blockingRequirements: [],
      commonPitfalls: ["This widget is an extension demo surface, not part of the typed workspace runtime model."],
    },
  },
  component: OrderBookWidget,
};

export const orderBookDepthWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "order-book-depth",
  widgetVersion: "1.0.0",
  title: "Order Book Depth",
  description: resolveWidgetDescription(descriptionMarkdown, "order-book-depth"),
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
    agentHints: {
      buildPurpose: "Use this widget to show depth-oriented order book distribution for one symbol.",
      whenToUse: ["Use when an extension surface needs a compact depth visualization."],
      whenNotToUse: ["Do not use when the workflow needs typed bindings or shared execution."],
      authoringSteps: ["Set the target symbol."],
      blockingRequirements: [],
      commonPitfalls: ["This widget is an extension demo surface, not part of the typed workspace runtime model."],
    },
  },
  component: OrderBookDepthWidget,
};
