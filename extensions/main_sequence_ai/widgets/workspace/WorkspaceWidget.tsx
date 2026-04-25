import { useEffect, useMemo } from "react";

import { ArrowUpRight, LayoutTemplate, Link2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { getWorkspacePath } from "@/features/dashboards/workspace-favorites";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  buildWorkspaceReferenceRuntimeState,
  normalizeWorkspaceReferenceRuntimeState,
  normalizeWorkspaceWidgetProps,
  resolveWorkspaceReferenceSelection,
  useWorkspaceReferenceCatalog,
  type WorkspaceWidgetProps,
} from "./workspaceReference";

function runtimeStateMatches(
  currentRuntimeState: Record<string, unknown> | undefined,
  nextRuntimeState: Record<string, unknown> | undefined,
) {
  const current = normalizeWorkspaceReferenceRuntimeState(currentRuntimeState);
  const next = normalizeWorkspaceReferenceRuntimeState(nextRuntimeState);

  return (
    current.status === next.status &&
    current.resolvedWorkspaceId === next.resolvedWorkspaceId &&
    current.resolvedWorkspaceTitle === next.resolvedWorkspaceTitle
  );
}

export function WorkspaceWidget({
  props,
  runtimeState,
  onRuntimeStateChange,
}: WidgetComponentProps<WorkspaceWidgetProps>) {
  const normalizedProps = normalizeWorkspaceWidgetProps(props);
  const {
    currentWorkspaceId,
    currentWorkspaceTitle,
    error,
    workspaceListLoading,
    workspaceListReady,
    workspaceMap,
    workspaceOptions,
  } = useWorkspaceReferenceCatalog();
  const selection = useMemo(
    () =>
      resolveWorkspaceReferenceSelection({
        currentWorkspaceId,
        currentWorkspaceTitle,
        error,
        workspaceId: normalizedProps.workspaceId,
        workspaceListLoading,
        workspaceListReady,
        workspaceMap,
        workspaceOptions,
      }),
    [
      currentWorkspaceId,
      currentWorkspaceTitle,
      error,
      normalizedProps.workspaceId,
      workspaceListLoading,
      workspaceListReady,
      workspaceMap,
      workspaceOptions,
    ],
  );
  const nextRuntimeState = useMemo(
    () => buildWorkspaceReferenceRuntimeState(selection),
    [selection],
  );
  const workspacePath =
    selection.status === "valid" && selection.targetWorkspaceId
      ? getWorkspacePath(selection.targetWorkspaceId)
      : null;

  useEffect(() => {
    if (!onRuntimeStateChange || runtimeStateMatches(runtimeState, nextRuntimeState)) {
      return;
    }

    onRuntimeStateChange(nextRuntimeState);
  }, [nextRuntimeState, onRuntimeStateChange, runtimeState]);

  return (
    <div className="flex h-full min-h-[180px] flex-col overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/60 bg-gradient-to-br from-emerald-500/10 via-background/40 to-sky-500/10">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="primary">Workspace</Badge>
        </div>
        <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 px-4 py-4">
        <div className="space-y-3">
          {selection.status === "loading" ? (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading workspace reference
              </div>
              <p className="text-sm text-muted-foreground">
                Resolving accessible workspaces before publishing the selected workspace id.
              </p>
            </>
          ) : null}

          {selection.status === "empty" ? (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Link2 className="h-4 w-4 text-primary" />
                No workspace selected
              </div>
              <p className="text-sm text-muted-foreground">
                Pick a target workspace in widget settings to publish its id as a bindable value.
              </p>
            </>
          ) : null}

          {selection.status === "self-reference" ? (
            <>
              <div className="text-sm font-medium text-foreground">Self-reference blocked</div>
              <p className="text-sm text-muted-foreground">
                This widget cannot point to the current workspace
                {selection.currentWorkspaceTitle ? ` (${selection.currentWorkspaceTitle})` : ""}.
              </p>
            </>
          ) : null}

          {selection.status === "missing" ? (
            <>
              <div className="text-sm font-medium text-foreground">Workspace not available</div>
              <p className="text-sm text-muted-foreground">
                Workspace <span className="font-mono">{selection.targetWorkspaceId}</span> is no
                longer available in the accessible workspace list, so this widget does not publish
                an output.
              </p>
            </>
          ) : null}

          {selection.status === "error" ? (
            <>
              <div className="text-sm font-medium text-foreground">Workspace lookup failed</div>
              <p className="text-sm text-muted-foreground">
                {selection.error ?? "Unable to load workspaces."}
              </p>
            </>
          ) : null}

          {selection.status === "valid" && selection.targetWorkspace ? (
            <>
              <div className="space-y-1">
                <div className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Target workspace
                </div>
                <div className="text-lg font-semibold tracking-tight text-foreground">
                  {selection.targetWorkspace.title}
                </div>
                {selection.targetWorkspace.description ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {selection.targetWorkspace.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This widget publishes only the selected workspace id.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral" className="border border-border/70 bg-card/55">
                  {selection.targetWorkspace.source || "workspace"}
                </Badge>
                <Badge variant="neutral" className="border border-border/70 bg-card/55">
                  id {selection.targetWorkspace.id}
                </Badge>
              </div>
            </>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/55 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Published output
            </div>
            <pre className="mt-2 overflow-auto font-mono text-xs leading-6 text-foreground">
{selection.status === "valid" && selection.targetWorkspaceId
  ? `{\n  "id": "${selection.targetWorkspaceId}"\n}`
  : "{\n  \"id\": null\n}"}
            </pre>
          </div>

          {workspacePath ? (
            <Link
              to={workspacePath}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open workspace
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
