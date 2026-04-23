import { FileText } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { MarkdownNoteWidget, type MarkdownNoteWidgetProps } from "./MarkdownNoteWidget";
import { MarkdownNoteWidgetSettings } from "./MarkdownNoteWidgetSettings";

const exampleContent = `# Daily Brief

## Priorities

- Review overnight risk changes.
- Confirm desk exceptions.
- Track the top three catalysts into the open.

| Desk | Status | Notes |
| --- | --- | --- |
| Macro | Watching | Central-bank speakers at 10:00 |
| Equities | Ready | Earnings follow-through remains strong |

> Keep this panel for text that needs structure, not just a one-line title.
`;

export const markdownNoteWidget = defineWidget<MarkdownNoteWidgetProps>({
  id: "markdown-note",
  widgetVersion: "1.2.0",
  title: "Markdown",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["markdown", "notes", "documentation", "content"],
  exampleProps: {
    content: exampleContent,
    contentWidth: "prose",
    contentVerticalAlign: "top",
    openLinksInNewTab: true,
  },
  mockProps: {
    content: exampleContent,
    contentWidth: "prose",
    contentVerticalAlign: "top",
    openLinksInNewTab: true,
  },
  settingsComponent: MarkdownNoteWidgetSettings,
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Stores authored Markdown content and a few presentation options.",
      fields: [
        {
          id: "content",
          label: "Markdown content",
          type: "markdown",
          required: true,
          source: "custom-settings",
        },
        {
          id: "contentWidth",
          label: "Content width",
          type: "enum",
          source: "custom-settings",
        },
        {
          id: "contentVerticalAlign",
          label: "Vertical alignment",
          type: "enum",
          source: "custom-settings",
        },
        {
          id: "openLinksInNewTab",
          label: "Open links in new tab",
          type: "boolean",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: ["Write or paste the Markdown content to render."],
    },
    io: {
      mode: "none",
      summary: "This widget renders local authored content and does not participate in typed widget IO.",
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "Runbook panel",
        summary: "Displays structured operational instructions with headings, lists, and tables.",
        props: {
          contentWidth: "prose",
          contentVerticalAlign: "center",
          openLinksInNewTab: true,
        },
      },
    ],
  },
  workspaceIcon: FileText,
  buildAgentSnapshot: ({ domTextContent, props }) => ({
    displayKind: "note",
    state: props.content?.trim() ? "ready" : "empty",
    summary: props.content?.trim()
      ? "Markdown note content is available."
      : "Markdown note is empty.",
    data: {
      content: props.content ?? "",
      contentWidth: props.contentWidth ?? "prose",
      contentVerticalAlign: props.contentVerticalAlign ?? "top",
      openLinksInNewTab: props.openLinksInNewTab !== false,
      renderedText: domTextContent?.trim() || "",
    },
  }),
  component: MarkdownNoteWidget,
});
