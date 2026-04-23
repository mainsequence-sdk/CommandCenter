import type { WidgetRailSummaryComponentProps } from "@/widgets/types";

import {
  normalizeWorkspaceReferenceRuntimeState,
  normalizeWorkspaceWidgetProps,
  type WorkspaceWidgetProps,
} from "./workspaceReference";

function resolveStatusLabel(runtimeState?: Record<string, unknown>) {
  const normalizedRuntimeState = normalizeWorkspaceReferenceRuntimeState(runtimeState);

  switch (normalizedRuntimeState.status) {
    case "valid":
      return "Ready";
    case "loading":
      return "Loading";
    case "self-reference":
      return "Blocked";
    case "missing":
      return "Missing";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function resolveWorkspaceIdLabel(
  props: WorkspaceWidgetProps,
  runtimeState?: Record<string, unknown>,
) {
  const normalizedProps = normalizeWorkspaceWidgetProps(props);
  const normalizedRuntimeState = normalizeWorkspaceReferenceRuntimeState(runtimeState);

  return normalizedRuntimeState.resolvedWorkspaceId ?? normalizedProps.workspaceId ?? "Not selected";
}

function resolveWorkspaceTitleLabel(runtimeState?: Record<string, unknown>) {
  const normalizedRuntimeState = normalizeWorkspaceReferenceRuntimeState(runtimeState);

  return normalizedRuntimeState.resolvedWorkspaceTitle ?? "Not resolved";
}

export function WorkspaceReferenceRailSummary({
  title,
  props,
  runtimeState,
}: WidgetRailSummaryComponentProps<WorkspaceWidgetProps>) {
  const statusLabel = resolveStatusLabel(runtimeState);
  const workspaceIdLabel = resolveWorkspaceIdLabel(props, runtimeState);
  const workspaceTitleLabel = resolveWorkspaceTitleLabel(runtimeState);

  return (
    <div className="pointer-events-none z-20 w-[232px] rounded-[calc(var(--radius)-4px)] border border-border/80 bg-popover/95 p-3 text-left shadow-xl backdrop-blur-sm">
      <div className="truncate text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">Workspace reference widget</div>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium text-foreground">{statusLabel}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Workspace</span>
          <span
            className="max-w-[138px] break-all text-right font-medium text-foreground"
            title={workspaceTitleLabel}
          >
            {workspaceTitleLabel}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">ID</span>
          <span
            className="max-w-[138px] break-all text-right font-mono text-foreground"
            title={workspaceIdLabel}
          >
            {workspaceIdLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
