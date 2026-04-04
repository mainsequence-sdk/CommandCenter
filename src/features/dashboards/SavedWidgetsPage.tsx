import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Layers3, Save, Shield, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { commandCenterConfig } from "@/config/command-center";
import { MainSequencePermissionsTab } from "../../../extensions/main_sequence/common/components/MainSequencePermissionsTab";
import {
  deleteSavedWidgetGroupInBackend,
  deleteSavedWidgetInstanceInBackend,
  fetchSavedWidgetGroupDetailFromBackend,
  fetchSavedWidgetGroupsFromBackend,
  fetchSavedWidgetInstanceDetailFromBackend,
  fetchSavedWidgetInstancesFromBackend,
  hasConfiguredSavedWidgetsBackend,
  updateSavedWidgetGroupInBackend,
  updateSavedWidgetInstanceInBackend,
  type SavedWidgetGroupMutationPayload,
  type SavedWidgetInstanceMutationPayload,
  type SavedWidgetInstanceRecord,
} from "./saved-widgets-api";

type SavedWidgetsPageTab = "widgets" | "groups";
type SavedWidgetsDetailTab = "overview" | "json" | "permissions";

function parseLabels(rawValue: string) {
  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index);
}

function formatLayoutSize(layout: SavedWidgetInstanceRecord["layout"]) {
  const cols = "cols" in layout ? layout.cols : layout.w;
  const rows = "rows" in layout ? layout.rows : layout.h;
  return `${cols}×${rows}`;
}

function toAtomicRowState(row: SavedWidgetInstanceRecord["row"]) {
  if (!row) {
    return undefined;
  }

  return {
    collapsed: false,
    children: [],
  };
}

export function SavedWidgetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const configured = hasConfiguredSavedWidgetsBackend();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedKind = searchParams.get("kind") === "groups" ? "groups" : "widgets";
  const selectedId = searchParams.get("savedWidget");
  const [detailTab, setDetailTab] = useState<SavedWidgetsDetailTab>("overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [labelsValue, setLabelsValue] = useState("");

  function selectEntry(kind: SavedWidgetsPageTab, id: string | null) {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("kind", kind);

    if (id) {
      nextParams.set("savedWidget", id);
    } else {
      nextParams.delete("savedWidget");
    }

    setSearchParams(nextParams, { replace: true });
  }

  const instancesQuery = useQuery({
    queryKey: ["saved-widgets", "instances"],
    queryFn: fetchSavedWidgetInstancesFromBackend,
    enabled: configured,
    staleTime: 60_000,
  });
  const groupsQuery = useQuery({
    queryKey: ["saved-widgets", "groups"],
    queryFn: fetchSavedWidgetGroupsFromBackend,
    enabled: configured,
    staleTime: 60_000,
  });
  const instanceDetailQuery = useQuery({
    queryKey: ["saved-widgets", "instances", selectedId],
    queryFn: () => fetchSavedWidgetInstanceDetailFromBackend(selectedId!),
    enabled: configured && selectedKind === "widgets" && Boolean(selectedId),
    staleTime: 60_000,
  });
  const groupDetailQuery = useQuery({
    queryKey: ["saved-widgets", "groups", selectedId],
    queryFn: () => fetchSavedWidgetGroupDetailFromBackend(selectedId!),
    enabled: configured && selectedKind === "groups" && Boolean(selectedId),
    staleTime: 60_000,
  });

  const selectedInstance = selectedKind === "widgets" ? instanceDetailQuery.data ?? null : null;
  const selectedGroup = selectedKind === "groups" ? groupDetailQuery.data ?? null : null;
  const selectedRecord = selectedInstance ?? selectedGroup;

  useEffect(() => {
    if (selectedId) {
      return;
    }

    if (selectedKind === "widgets" && instancesQuery.data?.[0]) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("kind", "widgets");
      nextParams.set("savedWidget", instancesQuery.data[0].id);
      setSearchParams(nextParams, { replace: true });
      return;
    }

    if (selectedKind === "groups" && groupsQuery.data?.[0]) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("kind", "groups");
      nextParams.set("savedWidget", groupsQuery.data[0].id);
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    groupsQuery.data,
    instancesQuery.data,
    searchParams,
    selectedId,
    selectedKind,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!selectedRecord) {
      setTitle("");
      setDescription("");
      setLabelsValue("");
      return;
    }

    setTitle(selectedRecord.title);
    setDescription(selectedRecord.description);
    setLabelsValue(selectedRecord.labels.join(", "));
  }, [selectedRecord]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecord || !selectedId) {
        throw new Error("Select a saved widget first.");
      }

      if (selectedKind === "widgets" && selectedInstance) {
        const payload: SavedWidgetInstanceMutationPayload = {
          title: title.trim(),
          description,
          labels: parseLabels(labelsValue),
          category: selectedInstance.category,
          source: selectedInstance.source,
          schemaVersion: selectedInstance.schemaVersion,
          widgetTypeId: selectedInstance.widgetTypeId,
          instanceTitle: selectedInstance.instanceTitle,
          props: selectedInstance.props,
          presentation: selectedInstance.presentation,
          bindings: selectedInstance.bindings,
          row: toAtomicRowState(selectedInstance.row),
          layout: selectedInstance.layout,
          position: selectedInstance.position,
          companions: selectedInstance.companions,
          requiredPermissions: selectedInstance.requiredPermissions,
        };

        return updateSavedWidgetInstanceInBackend(selectedId, payload);
      }

      if (selectedKind === "groups" && selectedGroup) {
        const payload: SavedWidgetGroupMutationPayload = {
          title: title.trim(),
          description,
          labels: parseLabels(labelsValue),
          category: selectedGroup.category,
          source: selectedGroup.source,
          schemaVersion: selectedGroup.schemaVersion,
          requiredPermissions: selectedGroup.requiredPermissions,
          members: selectedGroup.members.map((member) => ({
            memberKey: member.memberKey,
            sortOrder: member.sortOrder,
            layoutOverride: member.layoutOverride,
              widgetInstance: {
                title: member.widgetInstance.title,
                description: member.widgetInstance.description,
                labels: member.widgetInstance.labels,
                category: member.widgetInstance.category,
                source: member.widgetInstance.source,
                schemaVersion: member.widgetInstance.schemaVersion,
                widgetTypeId: member.widgetInstance.widgetTypeId,
                instanceTitle: member.widgetInstance.instanceTitle,
                props: member.widgetInstance.props,
                presentation: member.widgetInstance.presentation,
                row: toAtomicRowState(member.widgetInstance.row),
                layout: member.widgetInstance.layout,
                position: member.widgetInstance.position,
                companions: member.widgetInstance.companions,
              requiredPermissions: member.widgetInstance.requiredPermissions,
            },
          })),
          bindings: selectedGroup.bindings.map((binding) => ({
            sourceMemberKey: binding.sourceMemberKey,
            targetMemberKey: binding.targetMemberKey,
            inputId: binding.inputId,
            bindingPayload: binding.bindingPayload,
          })),
        };

        return updateSavedWidgetGroupInBackend(selectedId, payload);
      }

      throw new Error("Invalid saved widget selection.");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["saved-widgets", "instances"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-widgets", "groups"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-widgets", selectedKind, selectedId] }),
      ]);
      toast({
        title: selectedKind === "widgets" ? "Saved widget updated" : "Saved widget group updated",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: selectedKind === "widgets" ? "Unable to update saved widget" : "Unable to update saved widget group",
        description: error instanceof Error ? error.message : "Unknown update error.",
        variant: "error",
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecord || !selectedId) {
        throw new Error("Select a saved widget first.");
      }

      if (selectedKind === "widgets") {
        await deleteSavedWidgetInstanceInBackend(selectedId);
        return;
      }

      await deleteSavedWidgetGroupInBackend(selectedId);
    },
    onSuccess: async () => {
      selectEntry(selectedKind, null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["saved-widgets", "instances"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-widgets", "groups"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-widgets", selectedKind, selectedId] }),
      ]);
      setDeleteDialogOpen(false);
      toast({
        title: selectedKind === "widgets" ? "Saved widget deleted" : "Saved widget group deleted",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: selectedKind === "widgets" ? "Unable to delete saved widget" : "Unable to delete saved widget group",
        description: error instanceof Error ? error.message : "Unknown delete error.",
        variant: "error",
      });
    },
  });

  const filteredWidgets = useMemo(
    () =>
      (instancesQuery.data ?? []).filter((entry) =>
        !searchValue.trim()
          ? true
          : [entry.title, entry.description, entry.instanceTitle, entry.widgetTypeId, ...entry.labels]
              .join(" ")
              .toLowerCase()
              .includes(searchValue.toLowerCase()),
      ),
    [instancesQuery.data, searchValue],
  );
  const filteredGroups = useMemo(
    () =>
      (groupsQuery.data ?? []).filter((entry) =>
        !searchValue.trim()
          ? true
          : [entry.title, entry.description, ...entry.labels].join(" ").toLowerCase().includes(searchValue.toLowerCase()),
      ),
    [groupsQuery.data, searchValue],
  );
  const permissionObjectUrl =
    selectedKind === "widgets"
      ? commandCenterConfig.savedWidgets.instancesListUrl.trim()
      : commandCenterConfig.savedWidgets.groupsListUrl.trim();

  return (
    <div className="min-h-full overflow-auto px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="neutral" className="border border-border/70 bg-card/55">
              Saved widget library
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Saved Widgets</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Browse reusable widget instances and widget groups, then manage their metadata and sharing.
              </p>
            </div>
          </div>
        </div>

        {!configured ? (
          <div className="rounded-[var(--radius)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            Saved widget backend endpoints are not configured.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-sm ${selectedKind === "widgets" ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 bg-card/70 text-muted-foreground"}`}
            onClick={() => selectEntry("widgets", null)}
          >
            <span className="inline-flex items-center gap-2">
              <Boxes className="h-4 w-4" />
              Widgets
            </span>
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-sm ${selectedKind === "groups" ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 bg-card/70 text-muted-foreground"}`}
            onClick={() => selectEntry("groups", null)}
          >
            <span className="inline-flex items-center gap-2">
              <Layers3 className="h-4 w-4" />
              Groups
            </span>
          </button>
          <div className="ml-auto min-w-[240px] flex-1 sm:max-w-[360px]">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={selectedKind === "widgets" ? "Search saved widgets" : "Search saved groups"}
            />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-[calc(var(--radius)+2px)] border border-border/70 bg-card/70 p-3 shadow-[var(--shadow-panel)]">
            <div className="space-y-2">
              {(selectedKind === "widgets" ? filteredWidgets : filteredGroups).map((entry) => {
                const selected = selectedId === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`flex w-full flex-col items-start gap-2 rounded-[calc(var(--radius)-6px)] border px-3 py-3 text-left transition-colors ${selected ? "border-primary/60 bg-primary/10" : "border-border/70 bg-background/25 hover:bg-card/90"}`}
                    onClick={() => selectEntry(selectedKind, entry.id)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{entry.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {"widgetTypeId" in entry ? entry.widgetTypeId : `${entry.memberCount} members`}
                      </div>
                    </div>
                    {entry.description ? (
                      <div className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[calc(var(--radius)+2px)] border border-border/70 bg-card/70 p-5 shadow-[var(--shadow-panel)]">
            {!selectedRecord ? (
              <div className="flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">
                Select a saved widget or group to inspect it.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xl font-semibold text-foreground">{selectedRecord.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedKind === "widgets"
                        ? `${selectedInstance?.instanceTitle || selectedInstance?.widgetTypeId}`
                        : `${selectedGroup?.memberCount ?? 0} members`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                    <Button
                      onClick={() => {
                        void updateMutation.mutateAsync();
                      }}
                      disabled={!title.trim() || updateMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Saved widget detail tabs">
                  {([
                    ["overview", "Overview"],
                    ["json", "JSON"],
                    ["permissions", "Permissions"],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={detailTab === id}
                      className={`rounded-full border px-3 py-1.5 text-sm ${detailTab === id ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 bg-background/25 text-muted-foreground"}`}
                      onClick={() => setDetailTab(id)}
                    >
                      <span className="inline-flex items-center gap-2">
                        {id === "permissions" ? <Shield className="h-4 w-4" /> : null}
                        {label}
                      </span>
                    </button>
                  ))}
                </div>

                {detailTab === "overview" ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Title</div>
                        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Description</div>
                        <Textarea
                          className="min-h-28"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Labels</div>
                        <Input
                          value={labelsValue}
                          onChange={(event) => setLabelsValue(event.target.value)}
                          placeholder="rates, saved, template"
                        />
                      </div>
                    </div>
                    <div className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/25 p-4 text-sm text-muted-foreground">
                      {selectedKind === "widgets" && selectedInstance ? (
                        <>
                          <div>Widget type: <span className="text-foreground">{selectedInstance.widgetTypeId}</span></div>
                          <div>Instance title: <span className="text-foreground">{selectedInstance.instanceTitle || "Untitled"}</span></div>
                          <div>Layout: <span className="text-foreground">{formatLayoutSize(selectedInstance.layout)}</span></div>
                          <div>Companions: <span className="text-foreground">{selectedInstance.companions.length}</span></div>
                        </>
                      ) : selectedKind === "groups" && selectedGroup ? (
                        <>
                          <div>Members: <span className="text-foreground">{selectedGroup.members.length}</span></div>
                          <div>Bindings: <span className="text-foreground">{selectedGroup.bindings.length}</span></div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : detailTab === "json" ? (
                  <pre className="overflow-auto rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/25 p-4 text-xs text-foreground">
                    {JSON.stringify(selectedRecord, null, 2)}
                  </pre>
                ) : !permissionObjectUrl ? (
                  <div className="rounded-[calc(var(--radius)-4px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
                    Saved widget permissions are not configured.
                  </div>
                ) : (
                  <MainSequencePermissionsTab
                    objectId={selectedRecord.id}
                    objectUrl={permissionObjectUrl}
                    entityLabel={selectedKind === "widgets" ? "saved widget" : "saved widget group"}
                    enabled={configured}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ActionConfirmationDialog
        open={deleteDialogOpen && Boolean(selectedRecord)}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteDialogOpen(false);
          }
        }}
        onConfirm={async () => {
          await deleteMutation.mutateAsync();
        }}
        title={selectedKind === "widgets" ? "Delete Saved Widget" : "Delete Saved Widget Group"}
        actionLabel="delete"
        confirmButtonLabel="Delete"
        confirmWord="DELETE"
        objectLabel={selectedKind === "widgets" ? "saved widget" : "saved widget group"}
        objectSummary={
          selectedRecord ? (
            <div className="space-y-1">
              <div className="font-medium text-foreground">{selectedRecord.title}</div>
              <div className="text-xs text-muted-foreground">
                {selectedKind === "widgets"
                  ? (selectedInstance?.widgetTypeId ?? "Saved widget")
                  : `${selectedGroup?.memberCount ?? 0} members`}
              </div>
            </div>
          ) : undefined
        }
        description={
          selectedKind === "widgets"
            ? "This removes the saved widget instance from the reusable library."
            : "This removes the saved widget group and its canonical member/binding snapshot from the reusable library."
        }
        specialText="This action removes the saved library entry. It does not delete any live workspace widgets that were imported from it."
        tone="danger"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
