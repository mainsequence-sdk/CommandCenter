import { FileText } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";
import { CORE_RICH_TEXT_NOTE_WIDGET_ID } from "@/widgets/widget-type-normalization";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  RichTextNoteWidget,
  richTextNoteStarterHtml,
  type RichTextNoteWidgetProps,
} from "./RichTextNoteWidget";
import { RichTextNoteWidgetSettings } from "./RichTextNoteWidgetSettings";

export const richTextNoteWidget = defineWidget<RichTextNoteWidgetProps>({
  id: CORE_RICH_TEXT_NOTE_WIDGET_ID,
  widgetVersion: "1.12.0",
  title: "Rich Text",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["rich-text", "wysiwyg", "notes", "content"],
  exampleProps: {
    contentHtml: richTextNoteStarterHtml,
    contentWidth: "prose",
    contentVerticalAlign: "top",
    contentHorizontalAlign: "left",
    contentParagraphSpacing: 1,
    openLinksInNewTab: true,
    showHeader: false,
  },
  mockProps: {
    contentHtml: richTextNoteStarterHtml,
    contentWidth: "prose",
    contentVerticalAlign: "top",
    contentHorizontalAlign: "left",
    contentParagraphSpacing: 1,
    openLinksInNewTab: true,
    showHeader: false,
  },
  workspaceRuntimeMode: "local-ui",
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
          id: "contentHorizontalAlign",
          label: "Horizontal text alignment",
          type: "enum",
          source: "custom-settings",
        },
        {
          id: "contentParagraphSpacing",
          label: "Paragraph spacing",
          type: "number",
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
        "Use workspace edit mode to author content directly on the card, right-click to open the compact inline toolbar, or adjust the advanced HTML source in settings.",
      ],
      configurationNotes: [
        "This widget is rich-text-native and stores HTML as its canonical content format.",
        "Inline editing is available only on workspace canvas surfaces that support widget canvas editing.",
        "The inline editor opens a compact floating formatting toolbar on right-click in edit mode, with one unified text-style dropdown plus inline alignment and vertical-placement controls.",
        "The toolbar is positioned above the note when viewport space allows so it does not collide with widget title chrome.",
        "Presentation settings now also control horizontal text alignment, paragraph spacing in rem units, and vertical placement inside the card.",
        "New Rich Text widgets hide the shared widget header by default so the note reads like document content instead of a utility panel.",
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
      paragraphSpacingUnit: "rem",
      paragraphSpacingDefault: 1,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "Inline workspace note",
        summary: "Friendly rich text card authored directly on the workspace canvas.",
        props: {
          contentWidth: "prose",
          contentVerticalAlign: "top",
          contentParagraphSpacing: 1,
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
      contentParagraphSpacing: props.contentParagraphSpacing ?? 1,
      openLinksInNewTab: props.openLinksInNewTab !== false,
      renderedText: domTextContent?.trim() || "",
    },
  }),
  component: RichTextNoteWidget,
});
