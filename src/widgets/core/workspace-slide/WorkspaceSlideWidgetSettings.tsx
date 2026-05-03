import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  setWorkspaceSlideBandVisible,
  updateWorkspaceSlideBandSlot,
  WORKSPACE_SLIDE_BAND_SLOT_IDS,
  type WorkspaceSlideBandId,
  type WorkspaceSlideBandSlotId,
  type WorkspaceSlideSlotContent,
  type WorkspaceSlideWidgetProps,
  sanitizeWorkspaceSlideProps,
} from "./slide-model";

function createSlotDraft(type: WorkspaceSlideSlotContent["type"]): WorkspaceSlideSlotContent {
  if (type === "text") {
    return {
      type,
      text: "",
    };
  }

  if (type === "image") {
    return {
      type,
      imageUrl: "",
      imageAlt: "",
    };
  }

  return {
    type: "empty",
  };
}

function slotLabel(slotId: WorkspaceSlideBandSlotId) {
  switch (slotId) {
    case "left":
      return "Left";
    case "middle":
      return "Middle";
    case "right":
      return "Right";
    default:
      return slotId;
  }
}

function SlideBandSlotEditor({
  bandId,
  draftProps,
  editable,
  onDraftPropsChange,
}: {
  bandId: WorkspaceSlideBandId;
  draftProps: WorkspaceSlideWidgetProps;
  editable: boolean;
  onDraftPropsChange: (nextProps: WorkspaceSlideWidgetProps) => void;
}) {
  const slots = bandId === "header" ? draftProps.headerSlots : draftProps.footerSlots;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {WORKSPACE_SLIDE_BAND_SLOT_IDS.map((slotId) => {
        const slot = slots[slotId];

        return (
          <div
            key={`${bandId}-${slotId}`}
            className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-foreground">{slotLabel(slotId)}</div>
                <div className="text-xs text-muted-foreground">Slide-owned slot</div>
              </div>
              <Badge variant={slot.type === "empty" ? "neutral" : "primary"}>
                {slot.type === "empty" ? "Empty" : slot.type === "text" ? "Text" : "Image"}
              </Badge>
            </div>

            <div className="mt-3 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Content type
                </span>
                <Select
                  value={slot.type}
                  disabled={!editable}
                  onChange={(event) => {
                    onDraftPropsChange(
                      updateWorkspaceSlideBandSlot(
                        draftProps,
                        bandId,
                        slotId,
                        createSlotDraft(
                          event.target.value as WorkspaceSlideSlotContent["type"],
                        ),
                      ),
                    );
                  }}
                >
                  <option value="empty">Empty</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                </Select>
              </label>

              {slot.type === "text" ? (
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Text
                  </span>
                  <Textarea
                    rows={4}
                    value={slot.text ?? ""}
                    disabled={!editable}
                    onChange={(event) => {
                      onDraftPropsChange(
                        updateWorkspaceSlideBandSlot(draftProps, bandId, slotId, {
                          ...slot,
                          text: event.target.value,
                        }),
                      );
                    }}
                  />
                </label>
              ) : null}

              {slot.type === "image" ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Image URL
                    </span>
                    <Input
                      value={slot.imageUrl ?? ""}
                      disabled={!editable}
                      onChange={(event) => {
                        onDraftPropsChange(
                          updateWorkspaceSlideBandSlot(draftProps, bandId, slotId, {
                            ...slot,
                            imageUrl: event.target.value,
                          }),
                        );
                      }}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Alt text
                    </span>
                    <Input
                      value={slot.imageAlt ?? ""}
                      disabled={!editable}
                      onChange={(event) => {
                        onDraftPropsChange(
                          updateWorkspaceSlideBandSlot(draftProps, bandId, slotId, {
                            ...slot,
                            imageAlt: event.target.value,
                          }),
                        );
                      }}
                    />
                  </label>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WorkspaceSlideWidgetSettings({
  draftProps,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<WorkspaceSlideWidgetProps>) {
  const slide = sanitizeWorkspaceSlideProps(draftProps);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary">Slide</Badge>
          <Badge variant="neutral">Structural container</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          The slide has one widget stage in the body. Header and footer are slide-owned bands with
          `left / middle / right` slots for simple text and image content.
        </p>
      </div>

      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
        Only the slide body accepts normal workspace widgets. Header and footer slots are managed
        by the slide widget itself. Their heights are resized directly on canvas by dragging the
        visible horizontal delimiters.
      </div>

      {(["header", "footer"] as const).map((bandId) => {
        const enabled = bandId === "header" ? slide.headerEnabled : slide.footerEnabled;

        return (
          <div
            key={bandId}
            className="space-y-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {bandId === "header" ? "Header" : "Footer"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Three slide-owned slots: left, middle, right
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={enabled ? "primary" : "neutral"}>
                  {enabled ? "Enabled" : "Hidden"}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant={enabled ? "outline" : "default"}
                  onClick={() => {
                    onDraftPropsChange(
                      setWorkspaceSlideBandVisible(slide, bandId, !enabled),
                    );
                  }}
                >
                  {enabled ? "Hide band" : "Show band"}
                </Button>
              </div>
            </div>

            {enabled ? (
              <SlideBandSlotEditor
                bandId={bandId}
                draftProps={slide}
                editable
                onDraftPropsChange={onDraftPropsChange}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
