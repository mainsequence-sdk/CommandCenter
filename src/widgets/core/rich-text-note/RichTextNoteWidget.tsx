import { useEffect, type ReactNode } from "react";

import {
  Bold,
  Code2,
  FileText,
  Highlighter,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  FontSize,
  isRichTextFontSizeValue,
  richTextFontSizeOptions,
} from "./fontSizeExtension";

export type RichTextNoteWidth = "compact" | "prose" | "full";
export type RichTextNoteVerticalAlign = "top" | "center" | "bottom";

export interface RichTextNoteWidgetProps extends Record<string, unknown> {
  contentHtml?: string;
  contentWidth?: RichTextNoteWidth;
  contentVerticalAlign?: RichTextNoteVerticalAlign;
  emptyState?: string;
  openLinksInNewTab?: boolean;
  showHeader?: boolean;
}

const defaultEmptyState =
  "Use workspace edit mode to write directly on the card.";

const richTextContentClassName = cn(
  "min-w-0 text-foreground",
  "[&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1:first-child]:mt-0",
  "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-border/70 [&_h2]:pb-2 [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2:first-child]:mt-0",
  "[&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3:first-child]:mt-0",
  "[&_p]:my-4 [&_p]:text-foreground/90 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_ul]:my-4 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:marker:text-muted-foreground",
  "[&_ol]:my-4 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:marker:text-muted-foreground",
  "[&_li]:pl-1 [&_li]:text-foreground/90",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-3 [&_blockquote]:border-primary/45 [&_blockquote]:bg-muted/35 [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-6 [&_hr]:border-border/70",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-left",
  "[&_thead]:bg-muted/50",
  "[&_th]:border-b [&_th]:border-border/70 [&_th]:px-4 [&_th]:py-[var(--table-standard-header-padding-y)] [&_th]:font-semibold [&_th]:text-foreground",
  "[&_td]:border-t [&_td]:border-border/60 [&_td]:px-4 [&_td]:py-[var(--table-standard-cell-padding-y)] [&_td]:align-top [&_td]:text-foreground/90",
  "[&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-[calc(var(--radius)-8px)] [&_img]:border [&_img]:border-border/70",
  "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[calc(var(--radius)-8px)] [&_pre]:border [&_pre]:border-border/70 [&_pre]:bg-muted/50 [&_pre]:px-4 [&_pre]:py-3",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-foreground",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-4 hover:[&_a]:text-primary/80",
);

const starterHtml = `<h1>Desk Note</h1><p>Write rich text directly on the card in workspace edit mode.</p><ul><li>Use headings for sections</li><li>Use lists for operator checklists</li><li>Use links for runbooks and references</li></ul>`;

function normalizeRichTextHtml(value: RichTextNoteWidgetProps["contentHtml"]) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    return "";
  }

  if (/^<p>(?:<br\s*\/?>|\s|&nbsp;)*<\/p>$/i.test(trimmed)) {
    return "";
  }

  return trimmed;
}

export function normalizeRichTextNoteWidth(value: RichTextNoteWidgetProps["contentWidth"]) {
  if (value === "compact" || value === "full") {
    return value;
  }

  return "prose";
}

export function normalizeRichTextNoteVerticalAlign(
  value: RichTextNoteWidgetProps["contentVerticalAlign"],
): RichTextNoteVerticalAlign {
  if (value === "center" || value === "bottom") {
    return value;
  }

  return "top";
}

function resolveContentWidthClass(width: RichTextNoteWidth) {
  switch (width) {
    case "compact":
      return "max-w-2xl";
    case "full":
      return "max-w-none";
    case "prose":
    default:
      return "max-w-3xl";
  }
}

function resolveVerticalAlignClass(align: RichTextNoteVerticalAlign) {
  switch (align) {
    case "center":
      return "justify-center";
    case "bottom":
      return "justify-end";
    case "top":
    default:
      return "justify-start";
  }
}

function RichTextToolbarButton({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "default" : "outline"}
      disabled={disabled}
      className="h-8 w-8"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

type Props = WidgetComponentProps<RichTextNoteWidgetProps>;

export function RichTextNoteWidget({
  props,
  editable = false,
  onPropsChange,
}: Props) {
  const contentHtml = normalizeRichTextHtml(props.contentHtml);
  const emptyState = props.emptyState?.trim() || defaultEmptyState;
  const contentWidth = normalizeRichTextNoteWidth(props.contentWidth);
  const contentVerticalAlign = normalizeRichTextNoteVerticalAlign(props.contentVerticalAlign);
  const openLinksInNewTab = props.openLinksInNewTab !== false;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      TextStyle,
      FontSize,
      Underline,
      Link.configure({
        openOnClick: !editable,
        HTMLAttributes: openLinksInNewTab
          ? {
              target: "_blank",
              rel: "noreferrer noopener",
            }
          : {},
      }),
    ],
    content: contentHtml || "",
    editable,
    editorProps: {
      attributes: {
        class: cn(
          richTextContentClassName,
          "focus:outline-none",
          editable ? "min-h-[180px] cursor-text" : undefined,
        ),
        style:
          "font-size: var(--font-size-body-sm); line-height: var(--line-height-body);",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      if (!editable || !onPropsChange) {
        return;
      }

      const nextHtml = nextEditor.isEmpty ? undefined : nextEditor.getHTML();

      onPropsChange({
        ...props,
        contentHtml: nextHtml,
      });
    },
  }, [editable, openLinksInNewTab]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentHtml = normalizeRichTextHtml(editor.getHTML());

    if (currentHtml === contentHtml) {
      return;
    }

    editor.commands.setContent(contentHtml || "", { emitUpdate: false });
  }, [contentHtml, editor]);

  if (!editor) {
    return null;
  }

  const hasContent = Boolean(contentHtml);
  const containerClassName = cn("mx-auto min-w-0 w-full", resolveContentWidthClass(contentWidth));
  const activeFontSize = isRichTextFontSizeValue(editor.getAttributes("textStyle").fontSize)
    ? editor.getAttributes("textStyle").fontSize
    : "default";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      {editable ? (
        <div className="sticky top-0 z-10 border-b border-border/70 bg-card/94 px-3 py-2 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-1">
            <div className="min-w-[128px]">
              <Select
                value={activeFontSize}
                aria-label="Font size"
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (isRichTextFontSizeValue(nextValue)) {
                    editor.chain().focus().setFontSize(nextValue).run();
                    return;
                  }

                  editor.chain().focus().unsetFontSize().run();
                }}
              >
                {richTextFontSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <RichTextToolbarButton
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("heading", { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("code")}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code2 className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={activeFontSize !== "default"}
              onClick={() => editor.chain().focus().unsetFontSize().run()}
            >
              <Highlighter className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("link")}
              onClick={() => {
                const currentHref = editor.getAttributes("link").href as string | undefined;
                const nextHref = window.prompt("Link URL", currentHref ?? "https://");

                if (nextHref === null) {
                  return;
                }

                if (!nextHref.trim()) {
                  editor.chain().focus().unsetLink().run();
                  return;
                }

                editor.chain().focus().extendMarkRange("link").setLink({ href: nextHref.trim() }).run();
              }}
            >
              <Link2 className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              disabled={!editor.can().chain().focus().undo().run()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 className="h-4 w-4" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              disabled={!editor.can().chain().focus().redo().run()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 className="h-4 w-4" />
            </RichTextToolbarButton>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-full flex-1 flex-col p-4 md:p-5">
        <div
          className={cn(
            "flex min-h-full flex-1 flex-col",
            resolveVerticalAlignClass(contentVerticalAlign),
          )}
        >
          <div className={containerClassName}>
            {!hasContent && !editable ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <div className="flex max-w-md flex-col items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/28 px-5 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/65 text-muted-foreground">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">Rich text note is empty</div>
                    <p className="text-sm text-muted-foreground">{emptyState}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[calc(var(--radius)-6px)]">
                <EditorContent editor={editor} />
                {editable && !hasContent ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    Start typing directly on the card, or use the toolbar to format the note.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { starterHtml as richTextNoteStarterHtml };
