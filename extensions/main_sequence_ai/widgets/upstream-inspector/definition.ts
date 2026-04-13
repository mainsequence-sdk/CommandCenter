import { Waypoints } from "lucide-react";

import {
  CORE_VALUE_BOOLEAN_CONTRACT,
  CORE_VALUE_INTEGER_CONTRACT,
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_NUMBER_CONTRACT,
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";
import { defineWidget } from "@/widgets/types";

import {
  UPSTREAM_INSPECTOR_INPUT_ID,
  UpstreamInspectorWidget,
  type UpstreamInspectorWidgetProps,
} from "./UpstreamInspectorWidget";
import { UpstreamInspectorWidgetSettings } from "./UpstreamInspectorWidgetSettings";

export const UPSTREAM_INSPECTOR_WIDGET_ID = "main-sequence-ai-upstream-inspector";

export const upstreamInspectorWidget = defineWidget<UpstreamInspectorWidgetProps>({
  id: UPSTREAM_INSPECTOR_WIDGET_ID,
  title: "Upstream Inspector",
  description:
    "Bind an upstream widget output and inspect the resolved value as Markdown or raw text.",
  category: "Main Sequence AI",
  kind: "custom",
  source: "main_sequence_ai",
  defaultSize: { w: 10, h: 8 },
  responsive: {
    minWidthPx: 360,
  },
  requiredPermissions: ["workspaces:view"],
  tags: ["agents", "upstream", "bindings", "debug", "inspector"],
  exampleProps: {
    displayMode: "markdown",
  },
  mockProps: {
    content: "# Upstream Inspector\n\nBind a source widget output to inspect it here.\n",
    displayMode: "markdown",
  },
  io: {
    inputs: [{
      id: UPSTREAM_INSPECTOR_INPUT_ID,
      label: "Upstream value",
      accepts: [
        CORE_VALUE_STRING_CONTRACT,
        CORE_VALUE_JSON_CONTRACT,
        CORE_VALUE_NUMBER_CONTRACT,
        CORE_VALUE_INTEGER_CONTRACT,
        CORE_VALUE_BOOLEAN_CONTRACT,
      ],
      description:
        "Resolved upstream value to inspect. When bound, it overrides the fallback content from settings.",
    }],
  },
  settingsComponent: UpstreamInspectorWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: Waypoints,
  component: UpstreamInspectorWidget,
});
