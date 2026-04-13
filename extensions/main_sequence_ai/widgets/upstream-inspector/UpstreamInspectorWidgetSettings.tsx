import { Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  UpstreamInspectorWidget,
  type UpstreamInspectorWidgetProps,
} from "./UpstreamInspectorWidget";

export function UpstreamInspectorWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<UpstreamInspectorWidgetProps>) {
  const previewProps: UpstreamInspectorWidgetProps = {
    ...draftProps,
    content:
      draftProps.content?.trim() ||
      "# Upstream Inspector\n\nBind a source widget output to inspect it here.\n",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Upstream test</Badge>
        <Badge variant="neutral">Main Sequence AI</Badge>
        <Badge variant="neutral">Bindings sink</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Use this widget to inspect an upstream binding quickly. A bound upstream value takes
        priority over the fallback content below.
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">Display mode</span>
        <Select
          value={draftProps.displayMode === "raw" ? "raw" : "markdown"}
          disabled={!editable}
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              displayMode: event.target.value === "raw" ? "raw" : "markdown",
            });
          }}
        >
          <option value="markdown">Markdown</option>
          <option value="raw">Raw text</option>
        </Select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">Fallback content</span>
        <Textarea
          value={draftProps.content ?? ""}
          readOnly={!editable}
          spellCheck={false}
          placeholder="# Upstream Inspector"
          className="min-h-[180px] font-mono text-xs leading-6"
          onChange={(event) => {
            onDraftPropsChange({
              ...draftProps,
              content: event.target.value,
            });
          }}
        />
      </label>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Preview</div>
          <p className="mt-1 text-sm text-muted-foreground">
            The actual widget will render the bound upstream value when a binding is attached.
          </p>
        </div>

        <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/24">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <Waypoints className="h-3.5 w-3.5" />
            Preview
          </div>
          <div className="max-h-[280px] min-h-[160px] overflow-auto">
            <UpstreamInspectorWidget
              widget={{
                id: "main-sequence-ai-upstream-inspector-preview",
                title: "Upstream Inspector Preview",
                description: "Preview renderer",
                category: "Main Sequence AI",
                kind: "custom",
                source: "main_sequence_ai",
                defaultSize: { w: 10, h: 8 },
                component: UpstreamInspectorWidget,
              }}
              props={previewProps}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
