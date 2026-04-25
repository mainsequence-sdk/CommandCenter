import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WidgetSettingsComponentProps } from "@/widgets/types";
import { type UpstreamInspectorWidgetProps } from "./UpstreamInspectorWidget";

export function UpstreamInspectorWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<UpstreamInspectorWidgetProps>) {
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
    </div>
  );
}
