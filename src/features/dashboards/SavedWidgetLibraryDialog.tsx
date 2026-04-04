import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Download, Layers3, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import {
  fetchSavedWidgetGroupDetailFromBackend,
  fetchSavedWidgetGroupsFromBackend,
  fetchSavedWidgetInstanceDetailFromBackend,
  fetchSavedWidgetInstancesFromBackend,
  hasConfiguredSavedWidgetsBackend,
  type SavedWidgetGroupRecord,
  type SavedWidgetInstanceRecord,
} from "./saved-widgets-api";

type LibraryTab = "widgets" | "groups";

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.toLowerCase());
}

function formatLayoutSize(
  layout: SavedWidgetInstanceRecord["layout"],
) {
  const cols = "cols" in layout ? layout.cols : layout.w;
  const rows = "rows" in layout ? layout.rows : layout.h;
  return `${cols}×${rows}`;
}

export function SavedWidgetLibraryDialog({
  open,
  onClose,
  onImportGroup,
  onImportWidget,
}: {
  open: boolean;
  onClose: () => void;
  onImportGroup: (group: SavedWidgetGroupRecord) => void;
  onImportWidget: (widget: SavedWidgetInstanceRecord) => void;
}) {
  const { toast } = useToast();
  const configured = hasConfiguredSavedWidgetsBackend();
  const [activeTab, setActiveTab] = useState<LibraryTab>("widgets");
  const [searchValue, setSearchValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearchValue("");
    setSelectedId(null);
    setActiveTab("widgets");
  }, [open]);

  const instancesQuery = useQuery({
    queryKey: ["saved-widgets", "instances"],
    queryFn: fetchSavedWidgetInstancesFromBackend,
    enabled: open && configured,
    staleTime: 60_000,
  });
  const groupsQuery = useQuery({
    queryKey: ["saved-widgets", "groups"],
    queryFn: fetchSavedWidgetGroupsFromBackend,
    enabled: open && configured,
    staleTime: 60_000,
  });
  const selectedWidgetDetailQuery = useQuery({
    queryKey: ["saved-widgets", "instances", selectedId],
    queryFn: () => fetchSavedWidgetInstanceDetailFromBackend(selectedId!),
    enabled: open && configured && activeTab === "widgets" && Boolean(selectedId),
    staleTime: 60_000,
  });
  const selectedGroupDetailQuery = useQuery({
    queryKey: ["saved-widgets", "groups", selectedId],
    queryFn: () => fetchSavedWidgetGroupDetailFromBackend(selectedId!),
    enabled: open && configured && activeTab === "groups" && Boolean(selectedId),
    staleTime: 60_000,
  });

  const filteredWidgets = useMemo(
    () =>
      (instancesQuery.data ?? []).filter((entry) => {
        if (!searchValue.trim()) {
          return true;
        }

        return [
          entry.title,
          entry.description,
          entry.instanceTitle,
          entry.widgetTypeId,
          ...(entry.labels ?? []),
        ].some((field) => matchesSearch(field ?? "", searchValue));
      }),
    [instancesQuery.data, searchValue],
  );
  const filteredGroups = useMemo(
    () =>
      (groupsQuery.data ?? []).filter((entry) => {
        if (!searchValue.trim()) {
          return true;
        }

        return [entry.title, entry.description, ...(entry.labels ?? [])].some((field) =>
          matchesSearch(field ?? "", searchValue),
        );
      }),
    [groupsQuery.data, searchValue],
  );
  const selectedWidget = activeTab === "widgets" ? selectedWidgetDetailQuery.data ?? null : null;
  const selectedGroup = activeTab === "groups" ? selectedGroupDetailQuery.data ?? null : null;

  useEffect(() => {
    if (selectedId) {
      return;
    }

    if (activeTab === "widgets" && filteredWidgets[0]) {
      setSelectedId(filteredWidgets[0].id);
      return;
    }

    if (activeTab === "groups" && filteredGroups[0]) {
      setSelectedId(filteredGroups[0].id);
    }
  }, [activeTab, filteredGroups, filteredWidgets, selectedId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Saved Widget"
      description="Browse reusable saved widget instances and groups, then import them into the current workspace."
      className="max-w-[1080px]"
      contentClassName="space-y-4"
    >
      {!configured ? (
        <div className="rounded-[calc(var(--radius)-4px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Saved widget backend endpoints are not configured.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-sm ${activeTab === "widgets" ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 bg-card/70 text-muted-foreground"}`}
          onClick={() => {
            setActiveTab("widgets");
            setSelectedId(null);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Widgets
          </span>
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-sm ${activeTab === "groups" ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 bg-card/70 text-muted-foreground"}`}
          onClick={() => {
            setActiveTab("groups");
            setSelectedId(null);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Layers3 className="h-4 w-4" />
            Groups
          </span>
        </button>
        <div className="relative ml-auto min-w-[260px] flex-1 sm:max-w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={activeTab === "widgets" ? "Search saved widgets" : "Search saved widget groups"}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/25 p-3">
          <div className="space-y-2">
            {(activeTab === "widgets" ? filteredWidgets : filteredGroups).map((entry) => {
              const selected = selectedId === entry.id;

              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`flex w-full flex-col items-start gap-2 rounded-[calc(var(--radius)-6px)] border px-3 py-3 text-left transition-colors ${selected ? "border-primary/60 bg-primary/10" : "border-border/70 bg-card/65 hover:bg-card/82"}`}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{entry.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {"widgetTypeId" in entry ? entry.widgetTypeId : `${entry.memberCount} members`}
                      </div>
                    </div>
                    <Badge variant="neutral">
                      {"widgetTypeId" in entry ? "Widget" : "Group"}
                    </Badge>
                  </div>
                  {entry.description ? (
                    <div className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</div>
                  ) : null}
                </button>
              );
            })}

            {activeTab === "widgets" && !filteredWidgets.length && !instancesQuery.isLoading ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                No saved widgets matched the current filters.
              </div>
            ) : null}
            {activeTab === "groups" && !filteredGroups.length && !groupsQuery.isLoading ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                No saved widget groups matched the current filters.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/25 p-4">
          {activeTab === "widgets" ? (
            selectedWidget ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-foreground">{selectedWidget.title}</div>
                  <div className="text-sm text-muted-foreground">{selectedWidget.instanceTitle || selectedWidget.widgetTypeId}</div>
                </div>
                {selectedWidget.description ? (
                  <div className="text-sm text-muted-foreground">{selectedWidget.description}</div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">{selectedWidget.widgetTypeId}</Badge>
                  {selectedWidget.labels.map((label) => (
                    <Badge key={label} variant="neutral">
                      {label}
                    </Badge>
                  ))}
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/65 px-3 py-3 text-sm text-muted-foreground">
                  Layout: {formatLayoutSize(selectedWidget.layout)}
                  {selectedWidget.companions.length ? ` • ${selectedWidget.companions.length} companions` : ""}
                </div>
                <Button
                  onClick={() => {
                    onImportWidget(selectedWidget);
                    toast({
                      title: "Saved widget imported",
                      variant: "success",
                    });
                    onClose();
                  }}
                >
                  <Download className="h-4 w-4" />
                  Import widget
                </Button>
              </div>
            ) : (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                Select a saved widget to preview and import it.
              </div>
            )
          ) : selectedGroup ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-lg font-semibold text-foreground">{selectedGroup.title}</div>
                <div className="text-sm text-muted-foreground">{selectedGroup.memberCount} members</div>
              </div>
              {selectedGroup.description ? (
                <div className="text-sm text-muted-foreground">{selectedGroup.description}</div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {selectedGroup.labels.map((label) => (
                  <Badge key={label} variant="neutral">
                    {label}
                  </Badge>
                ))}
              </div>
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/65 px-3 py-3 text-sm text-muted-foreground">
                {selectedGroup.members.length} widgets • {selectedGroup.bindings.length} saved bindings
              </div>
              <Button
                onClick={() => {
                  onImportGroup(selectedGroup);
                  toast({
                    title: "Saved widget group imported",
                    variant: "success",
                  });
                  onClose();
                }}
              >
                <Download className="h-4 w-4" />
                Import group
              </Button>
            </div>
          ) : (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
              Select a saved widget group to preview and import it.
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
