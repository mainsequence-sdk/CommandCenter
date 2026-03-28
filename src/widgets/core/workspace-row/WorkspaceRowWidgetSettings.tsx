import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import type { WorkspaceRowWidgetProps } from "./WorkspaceRowWidget";

const fallbackRowColor = "#2563eb";
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;

function toColorInputValue(value: string | undefined) {
  if (value && hexColorPattern.test(value.trim())) {
    return value.trim().toLowerCase();
  }

  return fallbackRowColor;
}

export function WorkspaceRowWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<WorkspaceRowWidgetProps>) {
  const colorValue = toColorInputValue(draftProps.color);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Workspace row</Badge>
        <Badge variant="neutral">Layout</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Rows now behave like collapsible dashboard rows: a full-width header in the main grid that can collapse its
        child widgets into the row model. Collapse and expand from the row header on the canvas.
      </div>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Accent color</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tint the row header accent. Leave it on the theme default if you want the row to inherit the
            workspace palette.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={colorValue}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...draftProps,
                color: event.target.value,
              });
            }}
            className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Input
            value={draftProps.color ?? ""}
            readOnly={!editable}
            placeholder="theme default"
            onChange={(event) => {
              const nextValue = event.target.value.trim();

              onDraftPropsChange({
                ...draftProps,
                color: nextValue || undefined,
              });
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!editable || draftProps.color == null}
            onClick={() => {
              onDraftPropsChange({
                ...draftProps,
                color: undefined,
              });
            }}
          >
            Use theme
          </Button>
        </div>
      </section>

      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted/15 p-3 text-sm text-muted-foreground">
        Row title, collapse state, ordering, and row children are owned by the dashboard layout model,
        not by generic widget props.
      </div>
    </div>
  );
}
