import { FileText } from "lucide-react";

import { defineWidget } from "@/widgets/types";

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
  widgetVersion: "1.0.0",
  title: "Markdown",
  description: "Render Markdown notes, runbooks, and narrative context inside a dashboard widget.",
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["markdown", "notes", "documentation", "content"],
  exampleProps: {
    content: exampleContent,
    contentWidth: "prose",
    openLinksInNewTab: true,
  },
  mockProps: {
    content: exampleContent,
    contentWidth: "prose",
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
    agentHints: {
      buildPurpose:
        "Use this widget for narrative context, runbooks, instructions, and other rich text inside a workspace.",
      whenToUse: [
        "Use when the content is static authored documentation or commentary.",
      ],
      whenNotToUse: [
        "Do not use when the content should come from structured upstream data or execution outputs.",
      ],
      authoringSteps: [
        "Add the widget and write the Markdown body.",
        "Adjust width and link behavior if needed.",
      ],
      blockingRequirements: [],
      commonPitfalls: [
        "Large operational datasets should not be embedded as Markdown tables when a data widget exists.",
      ],
    },
    examples: [
      {
        label: "Runbook panel",
        summary: "Displays structured operational instructions with headings, lists, and tables.",
        props: {
          contentWidth: "prose",
          openLinksInNewTab: true,
        },
      },
    ],
  },
  workspaceIcon: FileText,
  component: MarkdownNoteWidget,
});
