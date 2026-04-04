import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import type { DashboardDefinition } from "@/dashboards/types";
import {
  buildSavedWidgetGroupPayloadFromDashboard,
  buildSavedWidgetInstancePayloadFromDashboard,
  analyzeSavedWidgetSelection,
} from "./saved-widgets";
import {
  createSavedWidgetGroupInBackend,
  createSavedWidgetInstanceInBackend,
  hasConfiguredSavedWidgetsBackend,
} from "./saved-widgets-api";

function parseLabels(rawValue: string) {
  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index);
}

export function SavedWidgetSaveDialog({
  dashboard,
  instanceId,
  open,
  onClose,
}: {
  dashboard: DashboardDefinition | null;
  instanceId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const configured = hasConfiguredSavedWidgetsBackend();
  const selectedWidget = useMemo(
    () => (dashboard && instanceId ? dashboard.widgets.find((widget) => widget.id === instanceId) ?? null : null),
    [dashboard, instanceId],
  );
  const selectionAnalysis = useMemo(
    () =>
      dashboard && instanceId
        ? analyzeSavedWidgetSelection(dashboard, instanceId)
        : {
            hasDependencies: false,
            hasStructuralChildren: false,
            requiresGroup: false,
            recommendedMode: "widget" as const,
            groupWidgetIds: [] as string[],
          },
    [dashboard, instanceId],
  );
  const defaultTitle = useMemo(() => {
    const baseTitle = selectedWidget?.title?.trim() || "Saved widget";

    return selectionAnalysis.recommendedMode === "group"
      ? `${baseTitle} group`
      : `${baseTitle} widget`;
  }, [selectedWidget?.title, selectionAnalysis.recommendedMode]);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [labelsValue, setLabelsValue] = useState("");
  const [saveMode, setSaveMode] = useState<"widget" | "group">(selectionAnalysis.recommendedMode);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(defaultTitle);
    setDescription("");
    setLabelsValue("");
    setSaveMode(selectionAnalysis.recommendedMode);
  }, [defaultTitle, open, selectionAnalysis.recommendedMode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dashboard || !instanceId) {
        throw new Error("Select a widget first.");
      }

      const labels = parseLabels(labelsValue);

      if (saveMode === "group") {
        const payload = buildSavedWidgetGroupPayloadFromDashboard(dashboard, instanceId, {
          title: title.trim(),
          description,
          labels,
        });

        if (!payload) {
          throw new Error("Unable to build the saved widget group payload.");
        }

        return createSavedWidgetGroupInBackend(payload);
      }

      const payload = buildSavedWidgetInstancePayloadFromDashboard(dashboard, instanceId, {
        title: title.trim(),
        description,
        labels,
      });

      if (!payload) {
        throw new Error("Unable to build the saved widget payload.");
      }

      return createSavedWidgetInstanceInBackend(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-widgets", "instances"] });
      void queryClient.invalidateQueries({ queryKey: ["saved-widgets", "groups"] });
      toast({
        title: saveMode === "group" ? "Saved widget group created" : "Saved widget created",
        variant: "success",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: saveMode === "group" ? "Unable to save widget group" : "Unable to save widget",
        description: error instanceof Error ? error.message : "Unknown save error.",
        variant: "error",
      });
    },
  });

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saveMutation.isPending) {
          onClose();
        }
      }}
      title="Save Widget"
      description="Store this widget or widget group in the shared saved-widget library."
      className="max-w-[860px]"
      contentClassName="space-y-5"
    >
      {!configured ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Saved widget backend endpoints are not configured.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Library title</div>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Saved widget title" />
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Description</div>
            <Textarea
              className="min-h-28"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what this saved widget is for"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Labels</div>
            <Input
              value={labelsValue}
              onChange={(event) => setLabelsValue(event.target.value)}
              placeholder="rates, spread, curve"
            />
            <div className="text-xs text-muted-foreground">Comma-separated labels for search and filtering.</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Save mode</div>
            <Select
              value={saveMode}
              onChange={(event) => {
                const nextMode = event.target.value === "group" ? "group" : "widget";
                setSaveMode(nextMode);
              }}
            >
              <option value="widget" disabled={selectionAnalysis.requiresGroup}>
                Widget
              </option>
              <option value="group">Widget group</option>
            </Select>
          </div>

          {selectionAnalysis.requiresGroup ? (
            <div className="rounded-[calc(var(--radius)-4px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Atomic saved widgets must stay self-contained. Use <strong>Widget group</strong> to preserve linked widgets and row-owned child widgets.
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/25 p-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selection</div>
            <div className="text-sm font-medium text-foreground">{selectedWidget?.title ?? "Unknown widget"}</div>
            <div className="text-xs text-muted-foreground">{selectedWidget?.widgetId ?? "No widget type"}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              {selectionAnalysis.hasDependencies
                ? `${selectionAnalysis.groupWidgetIds.length} required widgets`
                : selectionAnalysis.hasStructuralChildren
                  ? "Row structure detected"
                  : "Self-contained"}
            </Badge>
            <Badge variant="neutral">
              Recommended: {selectionAnalysis.recommendedMode === "group" ? "Widget group" : "Widget"}
            </Badge>
          </div>

          {selectionAnalysis.requiresGroup ? (
            <div className="flex items-start gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 px-3 py-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                {selectionAnalysis.hasStructuralChildren
                  ? "This selection includes row-owned child widgets. Save it as a group so each member stays atomic."
                  : "This widget depends on upstream source widgets. Saving it as a group will preserve the required members and imported bindings between them."}
              </div>
            </div>
          ) : null}

          <div className="pt-2">
            <Button
              className="w-full"
              onClick={() => {
                void saveMutation.mutateAsync();
              }}
              disabled={!configured || !title.trim() || saveMutation.isPending || !selectedWidget}
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending
                ? saveMode === "group"
                  ? "Saving group…"
                  : "Saving widget…"
                : saveMode === "group"
                  ? "Save widget group"
                  : "Save widget"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
