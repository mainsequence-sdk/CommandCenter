import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { ArrowLeft, LayoutTemplate, RotateCcw, Save, Shield, Trash2, X } from "lucide-react";

import { MainSequencePermissionsTab } from "../../../extensions/main_sequence/common/components/MainSequencePermissionsTab";
import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { commandCenterConfig } from "@/config/command-center";
import { cn } from "@/lib/utils";
import {
  parseWorkspaceSnapshot,
  restoreWorkspaceFromSnapshot,
  stringifyWorkspaceSnapshot,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";

type WorkspaceSettingsTabId = "configuration" | "permissions";

function getWorkspaceSettingsTabClassName(active: boolean) {
  return cn(
    "inline-flex cursor-pointer items-center gap-2 rounded-[calc(var(--radius)-4px)] border px-4 py-2 text-sm font-medium shadow-sm transition-[background-color,border-color,color,transform,box-shadow] hover:-translate-y-px hover:text-foreground hover:shadow-[0_10px_22px_-16px_hsl(var(--foreground)/0.5)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
    active
      ? "border-primary/45 bg-primary/12 text-foreground shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.72)]"
      : "border-border bg-card/80 text-muted-foreground hover:border-primary/20 hover:bg-muted/60",
  );
}

function normalizeWorkspaceLabels(labels: string[]) {
  return Array.from(
    new Set(
      labels
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function buildWorkspaceExportFilename(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "workspace"}.workspace.json`;
}

function parsePositiveInteger(
  value: string,
  fallback: number,
  options?: {
    min?: number;
    max?: number;
  },
) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  const minimum = options?.min ?? 1;
  const maximum = options?.max;
  const bounded = Math.max(minimum, parsed);

  return typeof maximum === "number" ? Math.min(bounded, maximum) : bounded;
}

export function CustomWorkspaceSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceSettingsTabId>("configuration");
  const [labelInput, setLabelInput] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jsonDialogMode, setJsonDialogMode] = useState<"export" | "import" | null>(null);
  const [jsonImportValue, setJsonImportValue] = useState("");
  const [jsonCopyFeedback, setJsonCopyFeedback] = useState<string | null>(null);
  const {
    user,
    workspaceListItems,
    selectedDashboard,
    resolvedDashboard,
    selectedWorkspaceDirty,
    isHydrating,
    isSaving,
    error,
    persistenceMode,
    setSelectedWorkspaceId,
    updateSelectedWorkspace,
    createWorkspace,
    createWorkspaceFromDefinition,
    deleteSelectedWorkspace,
    resetWorkspaceDraft,
    saveWorkspaceDraft,
  } = useCustomWorkspaceStudio();
  const backendMode = persistenceMode === "backend";

  useEffect(() => {
    setActiveTab("configuration");
    setLabelInput("");
    setJsonDialogMode(null);
    setJsonImportValue("");
    setJsonCopyFeedback(null);
  }, [selectedDashboard?.id]);

  const workspaceExportJson = useMemo(
    () => (selectedDashboard ? stringifyWorkspaceSnapshot(selectedDashboard) : ""),
    [selectedDashboard],
  );
  const parsedWorkspaceSnapshot = useMemo(
    () => parseWorkspaceSnapshot(jsonImportValue),
    [jsonImportValue],
  );
  const workspacePermissionsObjectUrl = useMemo(() => {
    const listUrl = commandCenterConfig.workspaces.listUrl.trim();
    return listUrl || null;
  }, []);

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening workspace settings.
      </div>
    );
  }

  if (!selectedDashboard) {
    return null;
  }

  const workspace = selectedDashboard;
  const sharingAvailable = backendMode && Boolean(workspacePermissionsObjectUrl);
  const modelDetailsCard = (
    <Card>
      <CardHeader>
        <CardTitle>Model details</CardTitle>
        <CardDescription>Current data for the selected workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Storage scope
          </div>
          <div className="mt-2 text-foreground">{persistenceMode} / {user.id}</div>
        </div>

        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Layout
          </div>
          <div className="mt-2 space-y-1 text-foreground">
            <div>Mode: {workspace.layoutKind ?? "custom"}</div>
            <div>{workspace.widgets.length} widgets</div>
            <div>{resolvedDashboard?.grid.columns ?? 12} columns</div>
          </div>
        </div>

        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            JSON snapshot
          </div>
          <div className="mt-2 text-muted-foreground">
            Export or recover this workspace as versioned JSON. The snapshot includes controls, widget props, layout, and widget runtime state when the widget supports it.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setJsonDialogMode("export");
              }}
            >
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setJsonDialogMode("import");
              }}
            >
              Import JSON
            </Button>
          </div>
        </div>

        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            setDeleteDialogOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete workspace
        </Button>
      </CardContent>
    </Card>
  );

  function closeJsonDialog() {
    setJsonDialogMode(null);
    setJsonImportValue("");
    setJsonCopyFeedback(null);
  }

  function setWorkspaceLabels(labels: string[]) {
    updateSelectedWorkspace((dashboard) => ({
      ...dashboard,
      labels: normalizeWorkspaceLabels(labels),
    }));
  }

  function commitLabel(rawValue: string) {
    const nextValue = rawValue.trim();

    if (!nextValue) {
      return;
    }

    setWorkspaceLabels([...(workspace.labels ?? []), nextValue]);
    setLabelInput("");
  }

  function removeLabel(labelToRemove: string) {
    setWorkspaceLabels((workspace.labels ?? []).filter((label) => label !== labelToRemove));
  }

  function handleLabelKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitLabel(labelInput);
      return;
    }

    if (event.key === "Backspace" && !labelInput) {
      const labels = workspace.labels ?? [];
      const lastLabel = labels.at(-1);

      if (lastLabel) {
        event.preventDefault();
        removeLabel(lastLabel);
      }
    }
  }

  async function handleCopyWorkspaceJson() {
    if (!navigator.clipboard?.writeText) {
      setJsonCopyFeedback("Clipboard API is not available in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(workspaceExportJson);
      setJsonCopyFeedback("Workspace JSON copied.");
    } catch {
      setJsonCopyFeedback("Unable to copy workspace JSON.");
    }
  }

  function handleDownloadWorkspaceJson() {
    const blob = new Blob([workspaceExportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = buildWorkspaceExportFilename(workspace.title);
    anchor.click();

    URL.revokeObjectURL(url);
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setJsonImportValue(await file.text());
    } finally {
      event.target.value = "";
    }
  }

  async function handleImportWorkspace(mode: "new" | "replace") {
    if (!parsedWorkspaceSnapshot.snapshot) {
      return;
    }

    if (mode === "replace") {
      updateSelectedWorkspace(() =>
        restoreWorkspaceFromSnapshot(parsedWorkspaceSnapshot.snapshot!, {
          workspaceId: workspace.id,
        }),
      );
      closeJsonDialog();
      return;
    }

    const importedWorkspace = restoreWorkspaceFromSnapshot(parsedWorkspaceSnapshot.snapshot);

    await createWorkspaceFromDefinition(importedWorkspace);

    closeJsonDialog();
  }

  return (
    <>
      <div className="relative h-full overflow-hidden">
        <div className="h-full overflow-y-auto px-4 py-4 pb-10 md:px-6 md:py-6">
          <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigate(`${getAppPath("workspace-studio", "workspaces")}?workspace=${encodeURIComponent(workspace.id)}`);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Canvas
              </Button>
              <Select
                className="min-w-[220px]"
                value={workspace.id}
                onChange={(event) => {
                  setSelectedWorkspaceId(event.target.value);
                }}
              >
                {workspaceListItems.map((dashboard) => (
                  <option key={dashboard.id} value={dashboard.id}>
                    {dashboard.title}
                  </option>
                ))}
              </Select>
              {isHydrating ? (
                <Badge variant="neutral">Loading</Badge>
              ) : isSaving ? (
                <Badge variant="neutral">Saving</Badge>
              ) : selectedWorkspaceDirty ? (
                <Badge variant="warning">Unsaved</Badge>
              ) : (
                <Badge variant="success">Saved</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void createWorkspace();
                }}
                disabled={isHydrating || isSaving}
              >
                <LayoutTemplate className="h-4 w-4" />
                New workspace
              </Button>
              <Button
                variant="outline"
                onClick={resetWorkspaceDraft}
                disabled={!selectedWorkspaceDirty}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={saveWorkspaceDraft}
                disabled={!selectedWorkspaceDirty || isSaving || isHydrating}
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-[var(--radius)] border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Workspace settings sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "configuration"}
                className={getWorkspaceSettingsTabClassName(activeTab === "configuration")}
                onClick={() => {
                  setActiveTab("configuration");
                }}
              >
                <LayoutTemplate className="h-4 w-4" />
                Configuration
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "permissions"}
                className={getWorkspaceSettingsTabClassName(activeTab === "permissions")}
                onClick={() => {
                  setActiveTab("permissions");
                }}
              >
                <Shield className="h-4 w-4" />
                Permissions
                {!backendMode ? <Badge variant="neutral">Backend only</Badge> : null}
              </button>
            </div>

            {activeTab === "configuration" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card>
                <CardHeader>
                  <CardTitle>Workspace configuration</CardTitle>
                  <CardDescription>
                    This page edits the selected workspace model instead of overlaying controls on the canvas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Workspace title
                </div>
                <Input
                  value={workspace.title}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateSelectedWorkspace((dashboard) => ({
                      ...dashboard,
                      title: value,
                    }));
                  }}
                  placeholder="Workspace title"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Description
                </div>
                <Textarea
                  className="min-h-40"
                  value={workspace.description}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateSelectedWorkspace((dashboard) => ({
                      ...dashboard,
                      description: value,
                    }));
                  }}
                  placeholder="Describe what this workspace is for"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Labels
                </div>
                <div className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 px-3 py-3 shadow-sm transition-colors focus-within:border-ring/70 focus-within:ring-2 focus-within:ring-ring/20">
                  <div className="flex flex-wrap items-center gap-2">
                    {(workspace.labels ?? []).map((label) => (
                      <Badge
                        key={label}
                        variant="neutral"
                        className="border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] text-foreground"
                      >
                        <span>{label}</span>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`Remove ${label} label`}
                          title={`Remove ${label} label`}
                          onClick={() => {
                            removeLabel(label);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      value={labelInput}
                      onChange={(event) => {
                        setLabelInput(event.target.value);
                      }}
                      onKeyDown={handleLabelKeyDown}
                      onBlur={() => {
                        commitLabel(labelInput);
                      }}
                      placeholder={
                        (workspace.labels ?? []).length
                          ? "Add another label"
                          : "Type a label and press Enter"
                      }
                      className="h-8 min-w-[180px] flex-1 border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Press Enter to add a label. Use Backspace on an empty field to remove the last one.
                </div>
              </div>

              <div className="space-y-4 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/24 p-4">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Layout mode
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Custom keeps explicit widget placement. Auto grid computes placement from layout rules.
                  </div>
                </div>

                <Select
                  value={workspace.layoutKind ?? "custom"}
                  onChange={(event) => {
                    const nextLayoutKind = event.target.value === "auto-grid" ? "auto-grid" : "custom";
                    updateSelectedWorkspace((dashboard) => ({
                      ...dashboard,
                      layoutKind: nextLayoutKind,
                    }));
                  }}
                >
                  <option value="custom">Custom</option>
                  <option value="auto-grid">Auto grid</option>
                </Select>

                {(workspace.layoutKind ?? "custom") === "auto-grid" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Fill screen
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={workspace.autoGrid?.fillScreen === true ? "default" : "outline"}
                          onClick={() => {
                            updateSelectedWorkspace((dashboard) => ({
                              ...dashboard,
                              autoGrid: {
                                ...dashboard.autoGrid,
                                fillScreen: true,
                              },
                            }));
                          }}
                        >
                          Fill
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={workspace.autoGrid?.fillScreen === true ? "outline" : "default"}
                          onClick={() => {
                            updateSelectedWorkspace((dashboard) => ({
                              ...dashboard,
                              autoGrid: {
                                ...dashboard.autoGrid,
                                fillScreen: false,
                              },
                            }));
                          }}
                        >
                          Natural
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Max columns
                      </div>
                      <Input
                        inputMode="numeric"
                        value={String(workspace.autoGrid?.maxColumns ?? 4)}
                        onChange={(event) => {
                          const current = workspace.autoGrid?.maxColumns ?? 4;
                          updateSelectedWorkspace((dashboard) => ({
                            ...dashboard,
                            autoGrid: {
                              ...dashboard.autoGrid,
                              maxColumns: parsePositiveInteger(event.target.value, current, {
                                min: 1,
                                max: 10,
                              }),
                            },
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Min column width
                      </div>
                      <Input
                        inputMode="numeric"
                        value={String(workspace.autoGrid?.minColumnWidthPx ?? 320)}
                        onChange={(event) => {
                          const current = workspace.autoGrid?.minColumnWidthPx ?? 320;
                          updateSelectedWorkspace((dashboard) => ({
                            ...dashboard,
                            autoGrid: {
                              ...dashboard.autoGrid,
                              minColumnWidthPx: parsePositiveInteger(event.target.value, current, {
                                min: 120,
                                max: 1200,
                              }),
                            },
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Row height
                      </div>
                      <Input
                        inputMode="numeric"
                        value={String(workspace.autoGrid?.rowHeight ?? resolvedDashboard?.grid.rowHeight ?? 18)}
                        onChange={(event) => {
                          const current = workspace.autoGrid?.rowHeight ?? resolvedDashboard?.grid.rowHeight ?? 18;
                          updateSelectedWorkspace((dashboard) => ({
                            ...dashboard,
                            autoGrid: {
                              ...dashboard.autoGrid,
                              rowHeight: parsePositiveInteger(event.target.value, current, {
                                min: 8,
                                max: 240,
                              }),
                            },
                          }));
                        }}
                      />
                    </div>
                    </div>
                  </div>
                ) : null}
              </div>
                </CardContent>
              </Card>

              {modelDetailsCard}
            </div>
            ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card>
                <CardHeader>
                  <CardTitle>Workspace sharing</CardTitle>
                  <CardDescription>
                    Use view and edit assignments to control who can access this workspace record.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!backendMode ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3 text-sm text-muted-foreground">
                      Workspace sharing is available only when Workspaces uses backend persistence.
                      Browser-local workspaces cannot be shared through RBAC.
                    </div>
                  ) : !workspacePermissionsObjectUrl ? (
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3 text-sm text-muted-foreground">
                      Workspace sharing is unavailable because the workspace backend list endpoint is not configured.
                    </div>
                  ) : (
                    <MainSequencePermissionsTab
                      objectId={workspace.id}
                      objectUrl={workspacePermissionsObjectUrl}
                      entityLabel="Workspace"
                      enabled={sharingAvailable}
                    />
                  )}
                </CardContent>
              </Card>

              {modelDetailsCard}
            </div>
            )}
          </div>
        </div>
      </div>

      <ActionConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
        }}
        title="Delete workspace"
        actionLabel="delete"
        objectLabel="workspace"
        objectSummary={
          <div className="space-y-1">
            <div className="font-medium text-foreground">{workspace.title}</div>
            <div className="text-sm text-muted-foreground">
              {workspace.widgets.length} widgets
            </div>
          </div>
        }
        description={
          persistenceMode === "backend"
            ? "This deletes the workspace from the backend. The workspace stays visible until the backend confirms deletion."
            : "This removes the workspace from local browser storage for this account."
        }
        specialText="This removes the current workspace from the saved collection. Type DELETE to continue."
        confirmWord="DELETE"
        confirmButtonLabel="Delete workspace"
        tone="danger"
        successToast={{
          title: "Workspace deleted",
          description: `${workspace.title} was deleted.`,
          variant: "success",
        }}
        errorToast={{
          title: "Delete failed",
          description: (caughtError) =>
            caughtError instanceof Error ? caughtError.message : "Unable to delete workspace.",
          variant: "error",
        }}
        onConfirm={async () => {
          const deleted = await deleteSelectedWorkspace();

          if (!deleted) {
            throw new Error("Unable to delete workspace.");
          }
        }}
        onSuccess={() => {
          setDeleteDialogOpen(false);
          navigate(getAppPath("workspace-studio", "workspaces"));
        }}
      />

      <Dialog
        open={jsonDialogMode === "export"}
        onClose={closeJsonDialog}
        title="Export workspace JSON"
        description="This snapshot includes workspace metadata, controls, widget props, layout, and widget runtime state captured in the current draft."
        className="max-w-[min(980px,calc(100vw-24px))]"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">schema / mainsequence.workspace</Badge>
            <Badge variant="neutral">version / 1</Badge>
            <Badge variant="neutral">{`${workspace.widgets.length} widgets`}</Badge>
          </div>
          <Textarea
            value={workspaceExportJson}
            readOnly
            spellCheck={false}
            className="min-h-[420px] font-mono text-xs leading-6"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {jsonCopyFeedback ?? "Copy or download the full workspace snapshot."}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCopyWorkspaceJson}>
                Copy JSON
              </Button>
              <Button variant="outline" onClick={handleDownloadWorkspaceJson}>
                Download file
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={jsonDialogMode === "import"}
        onClose={closeJsonDialog}
        title="Import workspace JSON"
        description={
          backendMode
            ? "Import into the backend-backed workspace collection."
            : "Import into the current draft, then use Save if you want to persist the recovered workspace."
        }
        className="max-w-[min(980px,calc(100vw-24px))]"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Paste a workspace snapshot or a raw workspace JSON object.
            </div>
            <Input
              type="file"
              accept=".json,application/json,text/json"
              className="max-w-[280px]"
              onChange={handleImportFileChange}
            />
          </div>

          <Textarea
            value={jsonImportValue}
            onChange={(event) => {
              setJsonImportValue(event.target.value);
            }}
            spellCheck={false}
            className="min-h-[320px] font-mono text-xs leading-6"
            placeholder="Paste workspace JSON here"
          />

          {jsonImportValue.trim() ? (
            parsedWorkspaceSnapshot.snapshot ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">valid JSON</Badge>
                  <Badge variant="neutral">
                    source / {parsedWorkspaceSnapshot.sourceFormat}
                  </Badge>
                  <Badge variant="neutral">
                    {`${parsedWorkspaceSnapshot.snapshot.workspace.widgets.length} widgets`}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-foreground">
                  <div>{parsedWorkspaceSnapshot.snapshot.workspace.title}</div>
                  <div className="text-muted-foreground">
                    {parsedWorkspaceSnapshot.snapshot.workspace.description}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                {parsedWorkspaceSnapshot.error}
              </div>
            )
          ) : (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
              Import preview appears after you paste JSON.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void handleImportWorkspace("new");
              }}
              disabled={!parsedWorkspaceSnapshot.snapshot}
            >
              Create new workspace
            </Button>
            <Button
              onClick={() => {
                void handleImportWorkspace("replace");
              }}
              disabled={!parsedWorkspaceSnapshot.snapshot}
            >
              Replace current workspace
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
