import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { ArrowLeft, LayoutTemplate, RotateCcw, Save, Trash2, X } from "lucide-react";

import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  parseWorkspaceSnapshot,
  restoreWorkspaceFromSnapshot,
  stringifyWorkspaceSnapshot,
} from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";

function formatSavedAt(savedAt: string | null) {
  if (!savedAt) {
    return "Not saved yet";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(savedAt));
  } catch {
    return savedAt;
  }
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

export function CustomWorkspaceSettingsPage() {
  const navigate = useNavigate();
  const [labelInput, setLabelInput] = useState("");
  const [jsonDialogMode, setJsonDialogMode] = useState<"export" | "import" | null>(null);
  const [jsonImportValue, setJsonImportValue] = useState("");
  const [jsonCopyFeedback, setJsonCopyFeedback] = useState<string | null>(null);
  const {
    user,
    draftCollection,
    selectedDashboard,
    resolvedDashboard,
    dirty,
    setSelectedWorkspaceId,
    updateDraftCollection,
    updateSelectedWorkspace,
    createWorkspace,
    deleteSelectedWorkspace,
    resetWorkspaceDraft,
    saveWorkspaceDraft,
    savedCollection,
  } = useCustomWorkspaceStudio();

  useEffect(() => {
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

  function handleImportWorkspace(mode: "new" | "replace") {
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

    updateDraftCollection((current) => ({
      ...current,
      dashboards: [importedWorkspace, ...current.dashboards],
      selectedDashboardId: importedWorkspace.id,
    }));
    setSelectedWorkspaceId(importedWorkspace.id);
    closeJsonDialog();
  }

  return (
    <>
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
              {draftCollection.dashboards.map((dashboard) => (
                <option key={dashboard.id} value={dashboard.id}>
                  {dashboard.title}
                </option>
              ))}
            </Select>
            {dirty ? <Badge variant="warning">Unsaved</Badge> : <Badge variant="success">Saved</Badge>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => createWorkspace()}>
              <LayoutTemplate className="h-4 w-4" />
              New workspace
            </Button>
            <Button variant="outline" onClick={resetWorkspaceDraft} disabled={!dirty}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button onClick={saveWorkspaceDraft} disabled={!dirty}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>

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
            </CardContent>
          </Card>

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
                <div className="mt-2 text-foreground">local-dev / {user.id}</div>
              </div>

              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 p-4 text-sm">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Layout
                </div>
                <div className="mt-2 space-y-1 text-foreground">
                  <div>{workspace.widgets.length} widgets</div>
                  <div>{resolvedDashboard?.grid.columns ?? 12} columns</div>
                  <div>Last saved {formatSavedAt(savedCollection.savedAt)}</div>
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
                  const confirmed = window.confirm(
                    `Delete workspace "${workspace.title}" from this browser's local development storage?`,
                  );

                  if (!confirmed) {
                    return;
                  }

                  deleteSelectedWorkspace();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete workspace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
        description="Import into the current draft, then use Save if you want to persist the recovered workspace in local browser storage."
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
                handleImportWorkspace("new");
              }}
              disabled={!parsedWorkspaceSnapshot.snapshot}
            >
              Create new workspace
            </Button>
            <Button
              onClick={() => {
                handleImportWorkspace("replace");
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
