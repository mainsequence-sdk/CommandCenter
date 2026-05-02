import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  FileText,
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
} from "./fontSizeExtension";

export type RichTextNoteWidth = "compact" | "prose" | "full";
export type RichTextNoteVerticalAlign = "top" | "center" | "bottom";
export type RichTextNoteHorizontalAlign = "left" | "center" | "right" | "justify";

export interface RichTextNoteWidgetProps extends Record<string, unknown> {
  contentHtml?: string;
  contentWidth?: RichTextNoteWidth;
  contentVerticalAlign?: RichTextNoteVerticalAlign;
  contentHorizontalAlign?: RichTextNoteHorizontalAlign;
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

export function normalizeRichTextNoteHorizontalAlign(
  value: RichTextNoteWidgetProps["contentHorizontalAlign"],
): RichTextNoteHorizontalAlign {
  if (value === "center" || value === "right" || value === "justify") {
    return value;
  }

  return "left";
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

function resolveHorizontalAlignClass(align: RichTextNoteHorizontalAlign) {
  switch (align) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    case "justify":
      return "text-justify";
    case "left":
    default:
      return "text-left";
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
      className="h-7 w-7"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function RichTextLayoutButton({
  active,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-7 px-2 text-[11px] font-medium"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

type RichTextStyleValue =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "text-sm"
  | "text-lg"
  | "text-xl"
  | "text-2xl"
  | "text-3xl"
  | "text-4xl";

function RichTextStyleSelect({
  value,
  onChange,
}: {
  value: RichTextStyleValue;
  onChange: (value: RichTextStyleValue) => void;
}) {
  return (
    <Select
      value={value}
      aria-label="Text style"
      className="h-7 min-w-[148px] text-xs"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onChange={(event) => {
        const nextValue = event.target.value;

        if (
          nextValue === "paragraph" ||
          nextValue === "heading-1" ||
          nextValue === "heading-2" ||
          nextValue === "text-sm" ||
          nextValue === "text-lg" ||
          nextValue === "text-xl" ||
          nextValue === "text-2xl" ||
          nextValue === "text-3xl" ||
          nextValue === "text-4xl"
        ) {
          onChange(nextValue);
        }
      }}
    >
      <option value="paragraph">Paragraph</option>
      <option value="heading-1">Heading 1</option>
      <option value="heading-2">Heading 2</option>
      <option value="text-sm">Small text</option>
      <option value="text-lg">Large text</option>
      <option value="text-xl">XL text</option>
      <option value="text-2xl">2XL text</option>
      <option value="text-3xl">3XL text</option>
      <option value="text-4xl">4XL text</option>
    </Select>
  );
}

type Props = WidgetComponentProps<RichTextNoteWidgetProps>;

export function RichTextNoteWidget({
  props,
  editable = false,
  onPropsChange,
}: Props) {
  const [editorFocused, setEditorFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [toolbarStyle, setToolbarStyle] = useState<CSSProperties | null>(null);
  const contentHtml = normalizeRichTextHtml(props.contentHtml);
  const emptyState = props.emptyState?.trim() || defaultEmptyState;
  const contentWidth = normalizeRichTextNoteWidth(props.contentWidth);
  const contentVerticalAlign = normalizeRichTextNoteVerticalAlign(props.contentVerticalAlign);
  const contentHorizontalAlign = normalizeRichTextNoteHorizontalAlign(props.contentHorizontalAlign);
  const openLinksInNewTab = props.openLinksInNewTab !== false;
  const updatePresentationProps = (patch: Partial<RichTextNoteWidgetProps>) => {
    if (!onPropsChange) {
      return;
    }

    onPropsChange({
      ...props,
      ...patch,
    });
  };

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
    onFocus: () => {
      setEditorFocused(true);
    },
    onBlur: () => {
      setEditorFocused(false);
    },
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

  useLayoutEffect(() => {
    if (!editable || !editorFocused) {
      setToolbarStyle(null);
      return undefined;
    }

    let frameId = 0;

    function updateToolbarPosition() {
      const rect = rootRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setToolbarStyle({
        position: "fixed",
        top: Math.max(12, rect.top + 12),
        left: Math.max(12, rect.left + 40),
        zIndex: 2147483000,
      });
    }

    updateToolbarPosition();
    frameId = window.requestAnimationFrame(updateToolbarPosition);

    window.addEventListener("resize", updateToolbarPosition);
    window.addEventListener("scroll", updateToolbarPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateToolbarPosition);
      window.removeEventListener("scroll", updateToolbarPosition, true);
    };
  }, [editable, editorFocused]);

  if (!editor) {
    return null;
  }

  const hasContent = Boolean(contentHtml);
  const containerClassName = cn(
    "mx-auto min-w-0 w-full",
    resolveContentWidthClass(contentWidth),
    resolveHorizontalAlignClass(contentHorizontalAlign),
  );
  const activeFontSize = isRichTextFontSizeValue(editor.getAttributes("textStyle").fontSize)
    ? editor.getAttributes("textStyle").fontSize
    : "default";
  const activeTextStyle: RichTextStyleValue = editor.isActive("heading", { level: 1 })
    ? "heading-1"
    : editor.isActive("heading", { level: 2 })
      ? "heading-2"
      : activeFontSize === "sm"
        ? "text-sm"
        : activeFontSize === "lg"
          ? "text-lg"
          : activeFontSize === "xl"
            ? "text-xl"
            : activeFontSize === "2xl"
              ? "text-2xl"
              : activeFontSize === "3xl"
                ? "text-3xl"
                : activeFontSize === "4xl"
                  ? "text-4xl"
      : "paragraph";

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 flex-col overflow-visible">
      {editable && editorFocused && toolbarStyle && typeof document !== "undefined"
        ? createPortal(
          <div
            className="pointer-events-auto w-max min-w-[640px] rounded-[calc(var(--radius)+6px)] border border-border/70 bg-background/94 px-2 py-2 shadow-[var(--shadow-panel)] backdrop-blur-xl"
            style={toolbarStyle}
            data-no-widget-drag="true"
          >
            <div className="flex flex-wrap items-center gap-1.5">
            <RichTextStyleSelect
              value={activeTextStyle}
              onChange={(nextValue) => {
                if (nextValue === "heading-1") {
                  editor.chain().focus().unsetFontSize().toggleHeading({ level: 1 }).run();
                  return;
                }

                if (nextValue === "heading-2") {
                  editor.chain().focus().unsetFontSize().toggleHeading({ level: 2 }).run();
                  return;
                }

                if (nextValue === "text-sm") {
                  editor.chain().focus().setParagraph().setFontSize("sm").run();
                  return;
                }

                if (nextValue === "text-lg") {
                  editor.chain().focus().setParagraph().setFontSize("lg").run();
                  return;
                }

                if (nextValue === "text-xl") {
                  editor.chain().focus().setParagraph().setFontSize("xl").run();
                  return;
                }

                if (nextValue === "text-2xl") {
                  editor.chain().focus().setParagraph().setFontSize("2xl").run();
                  return;
                }

                if (nextValue === "text-3xl") {
                  editor.chain().focus().setParagraph().setFontSize("3xl").run();
                  return;
                }

                if (nextValue === "text-4xl") {
                  editor.chain().focus().setParagraph().setFontSize("4xl").run();
                  return;
                }

                editor.chain().focus().unsetFontSize().setParagraph().run();
              }}
            />
            <RichTextToolbarButton
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={editor.isActive("code")}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code2 className="h-3.5 w-3.5" />
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
              <Link2 className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              disabled={!editor.can().chain().focus().undo().run()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              disabled={!editor.can().chain().focus().redo().run()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <div className="mx-1 h-5 w-px bg-border/70" />
            <RichTextToolbarButton
              active={contentHorizontalAlign === "left"}
              onClick={() => {
                updatePresentationProps({
                  contentHorizontalAlign: "left",
                });
              }}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={contentHorizontalAlign === "center"}
              onClick={() => {
                updatePresentationProps({
                  contentHorizontalAlign: "center",
                });
              }}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={contentHorizontalAlign === "right"}
              onClick={() => {
                updatePresentationProps({
                  contentHorizontalAlign: "right",
                });
              }}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextToolbarButton
              active={contentHorizontalAlign === "justify"}
              onClick={() => {
                updatePresentationProps({
                  contentHorizontalAlign: "justify",
                });
              }}
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </RichTextToolbarButton>
            <RichTextLayoutButton
              active={contentVerticalAlign === "top"}
              label="Top"
              onClick={() => {
                updatePresentationProps({
                  contentVerticalAlign: "top",
                });
              }}
            />
            <RichTextLayoutButton
              active={contentVerticalAlign === "center"}
              label="Mid"
              onClick={() => {
                updatePresentationProps({
                  contentVerticalAlign: "center",
                });
              }}
            />
            <RichTextLayoutButton
              active={contentVerticalAlign === "bottom"}
              label="Bot"
              onClick={() => {
                updatePresentationProps({
                  contentVerticalAlign: "bottom",
                });
              }}
            />
            </div>
          </div>,
          document.body,
        )
        : null}

      <div className="flex min-h-full flex-1 flex-col overflow-auto px-4 pt-4 pb-4 md:px-5 md:pt-5 md:pb-5">
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
                    Start typing directly on the card. The formatting toolbar appears when the note is focused.
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
