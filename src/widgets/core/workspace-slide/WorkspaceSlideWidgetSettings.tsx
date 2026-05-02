import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  sanitizeWorkspaceSlideProps,
  setWorkspaceSlideRegionVisible,
  type WorkspaceSlideWidgetProps,
} from "./slide-model";

export function WorkspaceSlideWidgetSettings({
  draftProps,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<WorkspaceSlideWidgetProps>) {
  const slide = sanitizeWorkspaceSlideProps(draftProps);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary">Slide</Badge>
          <Badge variant="neutral">Structural container</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          The slide stays on the normal workspace canvas and defines bounded presentation regions for
          normal workspace widgets.
        </p>
      </div>

      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
        Optional regions are enabled here in settings. Their dimensions are resized directly on the
        slide by dragging the delimiters.
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            id: "header" as const,
            label: "Header",
            enabled: slide.headerEnabled,
          },
          {
            id: "footer" as const,
            label: "Footer",
            enabled: slide.footerEnabled,
          },
          {
            id: "left" as const,
            label: "Left",
            enabled: slide.leftEnabled,
          },
          {
            id: "right" as const,
            label: "Right",
            enabled: slide.rightEnabled,
          },
        ].map((region) => (
          <div
            key={region.id}
            className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-foreground">{region.label}</div>
                <div className="text-xs text-muted-foreground">Optional slide region</div>
              </div>
              <Badge variant={region.enabled ? "primary" : "neutral"}>
                {region.enabled ? "Enabled" : "Hidden"}
              </Badge>
            </div>

            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant={region.enabled ? "outline" : "default"}
                onClick={() => {
                  onDraftPropsChange(
                    setWorkspaceSlideRegionVisible(slide, region.id, !region.enabled),
                  );
                }}
              >
                {region.enabled ? "Hide region" : "Show region"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
