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
  sanitizeWorkspaceSlideProps,
  type WorkspaceSlideWidgetProps,
} from "./slide-model";
import { WorkspaceSlideWidget } from "./WorkspaceSlideWidget";
import { WorkspaceSlideWidgetSettings } from "./WorkspaceSlideWidgetSettings";

export const workspaceSlideWidget = defineWidget<WorkspaceSlideWidgetProps>({
  id: WORKSPACE_SLIDE_WIDGET_ID,
  widgetVersion: "3.0.0",
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
    summary: "Full-width slide boundary with one body widget stage plus optional slide-owned header and footer slots.",
    data: {
      widgetRole: "structure",
      regionIds: ["body"],
      headerEnabled: sanitizeWorkspaceSlideProps(props).headerEnabled,
      footerEnabled: sanitizeWorkspaceSlideProps(props).footerEnabled,
    },
  }),
  settingsComponent: WorkspaceSlideWidgetSettings,
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Defines a slide-style structural container with one body widget stage and optional slide-owned header/footer slots.",
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
      ],
      requiredSetupSteps: [
        "Place the slide on the normal workspace canvas; it opens as a full-width presentation surface.",
        "Use the body as the only generic widget stage and add or move normal workspace widgets there.",
        "Enable header and footer only when the slide needs slide-owned text or image slots.",
        "Configure header/footer slot content from slide settings.",
        "Resize header and footer by dragging the visible horizontal delimiters on canvas.",
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
