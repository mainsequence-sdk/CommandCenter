import {
  WORKSPACE_SLIDE_MIN_HEIGHT_ROWS,
  WORKSPACE_SLIDE_WIDGET_ID,
} from "@/dashboards/structural-widgets";
import {
  resolveWidgetDescription,
  resolveWidgetUsageGuidance,
} from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  createEmptyWorkspaceSlideProps,
  type WorkspaceSlideWidgetProps,
} from "./slide-model";
import { WorkspaceSlideWidget } from "./WorkspaceSlideWidget";
import { WorkspaceSlideWidgetSettings } from "./WorkspaceSlideWidgetSettings";

export const workspaceSlideWidget = defineWidget<WorkspaceSlideWidgetProps>({
  id: WORKSPACE_SLIDE_WIDGET_ID,
  widgetVersion: "2.1.2",
  title: "Slide",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  defaultSize: { w: 12, h: WORKSPACE_SLIDE_MIN_HEIGHT_ROWS },
  requiredPermissions: ["workspaces:view"],
  tags: ["layout", "slide", "presentation", "container", "workspace"],
  exampleProps: createEmptyWorkspaceSlideProps(),
  mockProps: createEmptyWorkspaceSlideProps(),
  mockRuntimeState: {
    status: "ready",
  },
  workspaceRuntimeMode: "local-ui",
  canvasEditing: {
    mode: "inline",
  },
  buildAgentSnapshot: ({ props }) => ({
    displayKind: "custom",
    state: "ready",
    summary: "Full-width slide boundary that constrains normal workspace widgets into presentation regions.",
    data: {
      widgetRole: "structure",
      regionIds: ["header", "left", "body", "right", "footer"],
    },
  }),
  settingsComponent: WorkspaceSlideWidgetSettings,
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Defines a slide-style structural container with internal presentation regions.",
      fields: [
        {
          id: "headerEnabled",
          label: "Header enabled",
          type: "boolean",
          source: "custom-settings",
        },
        {
          id: "footerEnabled",
          label: "Footer enabled",
          type: "boolean",
          source: "custom-settings",
        },
        {
          id: "leftEnabled",
          label: "Left enabled",
          type: "boolean",
          source: "custom-settings",
        },
        {
          id: "rightEnabled",
          label: "Right enabled",
          type: "boolean",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: [
        "Place the slide on the normal workspace canvas; it opens as a full-width presentation surface.",
        "Enable optional edge regions from slide settings when the slide composition needs them.",
        "Add or move normal workspace widgets into slide regions.",
        "Resize optional regions by dragging the visible delimiters on canvas.",
      ],
    },
    io: {
      mode: "none",
      summary: "This widget is structural only and does not expose typed IO.",
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: WorkspaceSlideWidget,
});
