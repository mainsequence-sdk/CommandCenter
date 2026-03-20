import { useNavigate } from "react-router-dom";

import { ArrowLeft, LayoutTemplate, RotateCcw, Save, Trash2 } from "lucide-react";

import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

export function CustomWorkspaceSettingsPage() {
  const navigate = useNavigate();
  const {
    user,
    draftCollection,
    selectedDashboard,
    resolvedDashboard,
    dirty,
    setSelectedWorkspaceId,
    updateSelectedWorkspace,
    createWorkspace,
    deleteSelectedWorkspace,
    resetWorkspaceDraft,
    saveWorkspaceDraft,
    savedCollection,
  } = useCustomWorkspaceStudio();

  if (!user) {
    return (
      <div className="rounded-[var(--radius)] border border-border/80 bg-card/80 p-8 text-sm text-muted-foreground">
        Resolve a user session before opening custom workspace settings.
      </div>
    );
  }

  if (!selectedDashboard) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigate(`${getAppPath("workspace-studio", "canvas")}?workspace=${encodeURIComponent(selectedDashboard.id)}`);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Canvas
          </Button>
          <Select
            className="min-w-[220px]"
            value={selectedDashboard.id}
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
              This page edits the selected custom workspace model instead of overlaying controls on the canvas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Workspace title
              </div>
              <Input
                value={selectedDashboard.title}
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
                value={selectedDashboard.description}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model details</CardTitle>
            <CardDescription>Current data for the selected custom workspace.</CardDescription>
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
                <div>{selectedDashboard.widgets.length} widgets</div>
                <div>{resolvedDashboard?.grid.columns ?? 12} columns</div>
                <div>Last saved {formatSavedAt(savedCollection.savedAt)}</div>
              </div>
            </div>

            <Button
              variant="danger"
              className="w-full"
              onClick={() => {
                const confirmed = window.confirm(
                  `Delete workspace "${selectedDashboard.title}" from this browser's local development storage?`,
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
  );
}
