import { BookOpenText } from "lucide-react";

import { CORE_WIDGET_AGENT_CONTEXT_CONTRACT } from "@/widgets/shared/agent-context";
import { CORE_VALUE_STRING_CONTRACT } from "@/widgets/shared/value-contracts";
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

const MARKDOWN_NOTE_CONTENT_OUTPUT_ID = "markdown-content";

export const markdownNoteWidget = defineWidget<MarkdownNoteWidgetProps>({
  id: "markdown-note",
  widgetVersion: "1.4.0",
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
  io: {
    outputs: [{
      id: MARKDOWN_NOTE_CONTENT_OUTPUT_ID,
      label: "Markdown content",
      contract: CORE_VALUE_STRING_CONTRACT,
      description:
        "Authored markdown source text for downstream prompt-driven widgets such as Agent Terminal.",
      valueDescriptor: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
        description: "Raw markdown source stored in this widget.",
      },
      resolveValue: ({ props }) => (typeof props.content === "string" ? props.content : ""),
    }],
  },
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
      mode: "static",
      summary:
        "Publishes the authored markdown source as a string output and also exposes the platform-generated agent-context output derived from the widget snapshot.",
    },
    capabilities: {
      publishedContracts: [
        CORE_VALUE_STRING_CONTRACT,
        CORE_WIDGET_AGENT_CONTEXT_CONTRACT,
      ],
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
  workspaceIcon: BookOpenText,
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
