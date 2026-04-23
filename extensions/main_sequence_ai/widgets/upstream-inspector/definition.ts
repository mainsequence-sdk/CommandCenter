import { Waypoints } from "lucide-react";

import {
  CORE_VALUE_BOOLEAN_CONTRACT,
  CORE_VALUE_INTEGER_CONTRACT,
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_NUMBER_CONTRACT,
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  UPSTREAM_INSPECTOR_INPUT_ID,
  UpstreamInspectorWidget,
  type UpstreamInspectorWidgetProps,
} from "./UpstreamInspectorWidget";
import { UpstreamInspectorWidgetSettings } from "./UpstreamInspectorWidgetSettings";

export const UPSTREAM_INSPECTOR_WIDGET_ID = "main-sequence-ai-upstream-inspector";

export const upstreamInspectorWidget = defineWidget<UpstreamInspectorWidgetProps>({
  id: UPSTREAM_INSPECTOR_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Upstream Inspector",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
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
  workspaceRuntimeMode: "consumer",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Configures how one bound upstream value should be displayed for inspection.",
      requiredSetupSteps: [
        "Bind one upstream value or provide fallback content.",
        "Choose the display mode.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes one upstream binding value and renders it for inspection without owning execution.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one upstream primitive or JSON value and renders it as markdown or raw text.",
    },
    capabilities: {
      acceptedContracts: [
        CORE_VALUE_STRING_CONTRACT,
        CORE_VALUE_JSON_CONTRACT,
        CORE_VALUE_NUMBER_CONTRACT,
        CORE_VALUE_INTEGER_CONTRACT,
        CORE_VALUE_BOOLEAN_CONTRACT,
      ],
      supportedDisplayModes: ["markdown", "text"],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: UpstreamInspectorWidget,
});
