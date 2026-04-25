import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  normalizeWorkspaceWidgetProps,
  resolveWorkspaceReferenceSelection,
  useWorkspaceReferenceCatalog,
  type WorkspaceWidgetProps,
} from "./workspaceReference";

export function WorkspaceWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<WorkspaceWidgetProps>) {
  const normalizedProps = normalizeWorkspaceWidgetProps(draftProps);
  const {
    currentWorkspaceId,
    currentWorkspaceTitle,
    error,
    workspaceListLoading,
    workspaceListReady,
    workspaceMap,
    workspaceOptions,
  } = useWorkspaceReferenceCatalog();
  const selection = resolveWorkspaceReferenceSelection({
    currentWorkspaceId,
    currentWorkspaceTitle,
    error,
    workspaceId: normalizedProps.workspaceId,
    workspaceListLoading,
    workspaceListReady,
    workspaceMap,
    workspaceOptions,
  });
  const availableTargets = workspaceOptions
    .filter((workspace) => workspace.id !== currentWorkspaceId)
    .sort((left, right) => left.title.localeCompare(right.title));
  const currentValue = normalizedProps.workspaceId ?? "";
  const currentValueAvailable = availableTargets.some((workspace) => workspace.id === currentValue);
  const invalidSelectionLabel =
    currentValue && !currentValueAvailable
      ? selection.status === "self-reference"
        ? `Current workspace is not allowed (${currentValue})`
        : selection.status === "loading"
          ? `Loading workspace (${currentValue})`
          : `Unavailable workspace (${currentValue})`
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Main Sequence AI</Badge>
        <Badge variant="neutral">Workspace</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Publish one selected workspace id as a bindable value so agent widgets or other consumers
        can point at that workspace explicitly.
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <WidgetSettingFieldLabel
              className="text-sm font-medium text-topbar-foreground"
              help="Select the target workspace whose id this widget should publish. The current workspace is excluded so the widget cannot reference itself."
            >
              Target workspace
            </WidgetSettingFieldLabel>
            <p className="mt-1 text-sm text-muted-foreground">
              Select the workspace this widget should publish. The current workspace is excluded so
              the widget cannot point to itself.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!editable || !currentValue}
            onClick={() => {
              onDraftPropsChange({});
            }}
          >
            Clear
          </Button>
        </div>

        <Select
          value={currentValue}
          disabled={!editable || (workspaceListLoading && !workspaceListReady)}
          onChange={(event) => {
            const nextWorkspaceId = event.target.value.trim();

            onDraftPropsChange(nextWorkspaceId ? { workspaceId: nextWorkspaceId } : {});
          }}
        >
          <option value="">No workspace selected</option>
          {invalidSelectionLabel ? (
            <option value={currentValue}>{invalidSelectionLabel}</option>
          ) : null}
          {availableTargets.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.title} ({workspace.id})
            </option>
          ))}
        </Select>

        {workspaceListLoading && !workspaceListReady ? (
          <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accessible workspaces
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-4 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {!workspaceListLoading && workspaceListReady && !error && availableTargets.length === 0 ? (
          <div className="rounded-[16px] border border-border/70 bg-background/30 px-3 py-4 text-sm text-muted-foreground">
            No target workspaces were returned by the workspace list endpoint.
          </div>
        ) : null}

        {selection.status === "self-reference" ? (
          <div className="rounded-[16px] border border-warning/30 bg-warning/10 px-3 py-4 text-sm text-warning">
            This widget cannot publish the current workspace
            {selection.currentWorkspaceTitle ? ` (${selection.currentWorkspaceTitle})` : ""}.
          </div>
        ) : null}

        {selection.status === "missing" ? (
          <div className="rounded-[16px] border border-border/70 bg-background/30 px-3 py-4 text-sm text-muted-foreground">
            The saved workspace id <span className="font-mono">{selection.targetWorkspaceId}</span>
            {" "}is not available anymore. Pick another workspace to restore the output.
          </div>
        ) : null}

        {selection.status === "error" && !error ? (
          <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-4 text-sm text-danger">
            {selection.error ?? "Unable to load workspaces."}
          </div>
        ) : null}
      </section>

    </div>
  );
}
