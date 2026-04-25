import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  normalizeMarkdownNoteVerticalAlign,
  normalizeMarkdownNoteWidth,
  type MarkdownNoteWidgetProps,
} from "./MarkdownNoteWidget";

const starterMarkdown = `# Desk Note

## Opening checks

- Review the overnight catalyst tape.
- Confirm restricted-list changes before routing.
- Flag any names that need manual supervision.

> Keep this widget for narrative context that does not fit a chart or table.
`;

export function MarkdownNoteWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<MarkdownNoteWidgetProps>) {
  const contentWidth = normalizeMarkdownNoteWidth(draftProps.contentWidth);
  const contentVerticalAlign = normalizeMarkdownNoteVerticalAlign(draftProps.contentVerticalAlign);
  const openLinksInNewTab = draftProps.openLinksInNewTab !== false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Markdown</Badge>
        <Badge variant="neutral">Core widget</Badge>
        <Badge variant="neutral">Narrative content</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Use Markdown for runbooks, operator notes, market context, or lightweight documentation
        directly on the dashboard canvas.
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-topbar-foreground">Content</div>
            <p className="mt-1 text-sm text-muted-foreground">
              The widget stores raw Markdown in its instance props, so workspace persistence and
              duplication work without extra plumbing.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!editable}
            onClick={() => {
              onDraftPropsChange({
                ...draftProps,
                content: starterMarkdown,
              });
            }}
          >
            Use starter template
          </Button>
        </div>

        <Textarea
          value={draftProps.content ?? ""}
          readOnly={!editable}
          spellCheck={false}
          placeholder="# Desk Note\n\nWrite Markdown here."
          className="min-h-[220px] font-mono text-xs leading-6"
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              content: event.target.value,
            });
          }}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Content width</span>
          <Select
            value={contentWidth}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                contentWidth: normalizeMarkdownNoteWidth(event.target.value as MarkdownNoteWidgetProps["contentWidth"]),
              });
            }}
          >
            <option value="compact">Compact</option>
            <option value="prose">Prose</option>
            <option value="full">Full width</option>
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Vertical alignment</span>
          <Select
            value={contentVerticalAlign}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                contentVerticalAlign: normalizeMarkdownNoteVerticalAlign(
                  event.target.value as MarkdownNoteWidgetProps["contentVerticalAlign"],
                ),
              });
            }}
          >
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Empty-state helper</span>
          <Input
            value={draftProps.emptyState ?? ""}
            readOnly={!editable}
            placeholder="Optional helper text when the note is empty"
            onChange={(event) => {
              const nextValue = event.target.value;

              onDraftPropsChange({
                ...draftProps,
                emptyState: nextValue.trim() ? nextValue : undefined,
              });
            }}
          />
        </label>
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Links</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose whether Markdown links open in a new tab or reuse the current tab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={openLinksInNewTab ? "default" : "outline"}
            disabled={!editable}
            onClick={() => {
              onDraftPropsChange({
                ...draftProps,
                openLinksInNewTab: true,
              });
            }}
          >
            New tab
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!openLinksInNewTab ? "default" : "outline"}
            disabled={!editable}
            onClick={() => {
              onDraftPropsChange({
                ...draftProps,
                openLinksInNewTab: false,
              });
            }}
          >
            Same tab
          </Button>
        </div>
      </section>
    </div>
  );
}
