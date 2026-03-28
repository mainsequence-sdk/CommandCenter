import { FileText } from "lucide-react";

import type { WidgetDefinition } from "@/widgets/types";

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

export const markdownNoteWidget: WidgetDefinition<MarkdownNoteWidgetProps> = {
  id: "markdown-note",
  title: "Markdown",
  description: "Render Markdown notes, runbooks, and narrative context inside a dashboard widget.",
  category: "Content",
  kind: "custom",
  source: "core",
  defaultSize: { w: 6, h: 6 },
  requiredPermissions: ["dashboard:view"],
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
  railIcon: FileText,
  component: MarkdownNoteWidget,
};
