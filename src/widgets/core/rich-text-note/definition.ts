import { FileText } from "lucide-react";

import { resolveWidgetDescription } from "@/widgets/shared/widget-description";
import { defineWidget } from "@/widgets/types";

import descriptionMarkdown from "./DESCRIPTION.md?raw";
import {
  RichTextNoteWidget,
  richTextNoteStarterHtml,
  type RichTextNoteWidgetProps,
} from "./RichTextNoteWidget";
import { RichTextNoteWidgetSettings } from "./RichTextNoteWidgetSettings";

export const richTextNoteWidget = defineWidget<RichTextNoteWidgetProps>({
  id: "rich-text-note",
  widgetVersion: "1.1.0",
  title: "Rich Text",
  description: resolveWidgetDescription(descriptionMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["rich-text", "wysiwyg", "notes", "content"],
  exampleProps: {
    contentHtml: richTextNoteStarterHtml,
    contentWidth: "prose",
    contentVerticalAlign: "top",
    openLinksInNewTab: true,
  },
  mockProps: {
    contentHtml: richTextNoteStarterHtml,
    contentWidth: "prose",
    contentVerticalAlign: "top",
    openLinksInNewTab: true,
  },
  canvasEditing: {
    mode: "inline",
  },
  settingsComponent: RichTextNoteWidgetSettings,
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Stores rich text HTML content and presentation options. Primary authoring happens inline on the workspace canvas in edit mode.",
      fields: [
        {
          id: "contentHtml",
          label: "HTML content",
          type: "html-string",
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
        {
          id: "inlineFontSize",
          label: "Inline font size",
          type: "enum",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: [
        "Add the widget to a workspace.",
        "Use workspace edit mode to author content directly on the card or adjust the advanced HTML source in settings.",
      ],
      configurationNotes: [
        "This widget is rich-text-native and stores HTML as its canonical content format.",
        "Inline editing is available only on workspace canvas surfaces that support widget canvas editing.",
        "The inline toolbar exposes constrained font-size tokens, including larger display sizes for title cards.",
      ],
    },
    io: {
      mode: "none",
      summary: "This widget renders local authored rich text and does not participate in typed widget IO.",
    },
    capabilities: {
      canvasEditingMode: "inline",
      contentFormat: "html",
      editor: "tiptap",
      inlineFontSizeOptions: ["sm", "base", "lg", "xl", "2xl", "3xl", "4xl"],
    },
    agentHints: {
      buildPurpose:
        "Use this widget for friendly rich text authoring directly on the workspace canvas when Markdown source editing would be too technical or too slow.",
      whenToUse: [
        "Use when non-technical users should edit narrative card content directly on the workspace.",
        "Use when the note should be authored as WYSIWYG rich text instead of raw markdown.",
      ],
      whenNotToUse: [
        "Do not use when markdown source fidelity matters.",
        "Do not use when the content should come from structured upstream data or execution outputs.",
      ],
      authoringSteps: [
        "Add the widget to a workspace.",
        "Enter workspace edit mode and write directly on the card.",
        "Use the font-size control in the inline toolbar for body, emphasis, or display-title sizing.",
        "Adjust width, vertical alignment, or link behavior in settings if needed.",
      ],
      blockingRequirements: [],
      commonPitfalls: [
        "This widget stores HTML, not markdown.",
        "Inline editing depends on host support for canvas editing.",
      ],
    },
    examples: [
      {
        label: "Inline workspace note",
        summary: "Friendly rich text card authored directly on the workspace canvas.",
        props: {
          contentWidth: "prose",
          contentVerticalAlign: "top",
          openLinksInNewTab: true,
        },
      },
    ],
  },
  workspaceIcon: FileText,
  buildAgentSnapshot: ({ domTextContent, props }) => ({
    displayKind: "note",
    state: props.contentHtml?.trim() ? "ready" : "empty",
    summary: props.contentHtml?.trim()
      ? "Rich text note content is available."
      : "Rich text note is empty.",
    data: {
      contentHtml: props.contentHtml ?? "",
      contentWidth: props.contentWidth ?? "prose",
      contentVerticalAlign: props.contentVerticalAlign ?? "top",
      openLinksInNewTab: props.openLinksInNewTab !== false,
      renderedText: domTextContent?.trim() || "",
    },
  }),
  component: RichTextNoteWidget,
});
