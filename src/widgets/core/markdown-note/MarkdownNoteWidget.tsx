import { FileText } from "lucide-react";

import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import type { WidgetComponentProps } from "@/widgets/types";

export type MarkdownNoteWidth = "compact" | "prose" | "full";

export interface MarkdownNoteWidgetProps extends Record<string, unknown> {
  content?: string;
  contentWidth?: MarkdownNoteWidth;
  emptyState?: string;
  openLinksInNewTab?: boolean;
  showHeader?: boolean;
}

const defaultEmptyState =
  "Add Markdown content in widget settings to show notes, operating instructions, or narrative context.";

export function normalizeMarkdownNoteWidth(value: MarkdownNoteWidgetProps["contentWidth"]) {
  if (value === "compact" || value === "full") {
    return value;
  }

  return "prose";
}

function resolveMarkdownWidthClass(width: MarkdownNoteWidth) {
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

type Props = WidgetComponentProps<MarkdownNoteWidgetProps>;

export function MarkdownNoteWidget({ props }: Props) {
  const content = props.content?.trim() ?? "";
  const emptyState = props.emptyState?.trim() || defaultEmptyState;
  const contentWidth = normalizeMarkdownNoteWidth(props.contentWidth);
  const openLinksInNewTab = props.openLinksInNewTab !== false;

  if (!content) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-5">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/28 px-5 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/65 text-muted-foreground">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">Markdown note is empty</div>
            <p className="text-sm text-muted-foreground">{emptyState}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-4 md:p-5">
      <div className={cn("mx-auto min-w-0", resolveMarkdownWidthClass(contentWidth))}>
        <MarkdownContent
          content={content}
          openLinksInNewTab={openLinksInNewTab}
        />
      </div>
    </div>
  );
}
