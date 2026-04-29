import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useDashboardWidgetDependencies } from "@/dashboards/DashboardWidgetDependencies";
import { useDashboardWidgetExecution } from "@/dashboards/DashboardWidgetExecution";
import type {
  DashboardDefinition,
  ResolvedDashboardDefinition,
} from "@/dashboards/types";

import { buildWorkspaceAgentSnapshotArchive } from "./archive";
import type {
  CommandCenterSnapshotWindowState,
  WorkspaceSnapshotCaptureProfile,
} from "./types";

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function publishSnapshotState(state: CommandCenterSnapshotWindowState) {
  window.__COMMAND_CENTER_SNAPSHOT__ = state;
  window.dispatchEvent(
    new CustomEvent("command-center:snapshot-ready", {
      detail: state,
    }),
  );
}

export function downloadWorkspaceSnapshotArchive(url: string, name: string) {
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = name;
  anchor.click();
}

function formatSnapshotTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function formatSnapshotBytes(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    notation: value >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

export function WorkspaceSnapshotStatusCard({
  snapshotState,
  profile,
}: {
  snapshotState: CommandCenterSnapshotWindowState;
  profile: WorkspaceSnapshotCaptureProfile;
}) {
  const title =
    snapshotState.status === "ready"
      ? "Snapshot ready"
      : snapshotState.status === "running"
        ? "Creating snapshot"
        : "Snapshot failed";
  const description =
    snapshotState.status === "ready"
      ? `${profile} archive prepared${snapshotState.archiveSizeBytes ? ` · ${formatSnapshotBytes(snapshotState.archiveSizeBytes)} bytes` : ""}`
      : snapshotState.status === "running"
        ? "Workspace snapshot capture is in progress."
        : snapshotState.error ?? "Workspace snapshot capture failed.";
  const completedLabel = formatSnapshotTimestamp(
    snapshotState.completedAt ?? snapshotState.startedAt,
  );
  const warnings = snapshotState.warnings?.length ?? 0;
  const errors = snapshotState.errors?.length ?? 0;

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-card/80 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{title}</div>
        <div className="truncate">
          {description}
          {completedLabel ? ` · ${completedLabel}` : ""}
          {warnings > 0 ? ` · ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}
          {errors > 0 ? ` · ${errors} error${errors === 1 ? "" : "s"}` : ""}
        </div>
      </div>
    </div>
  );
}

async function waitForWorkspaceToSettle(input: {
  widgetIds: string[];
  activeRefreshCycleId?: string;
  getExecutionState: (instanceId?: string) => { status?: string } | undefined;
}) {
  const timeoutAt = Date.now() + 20_000;
  let lastBusyAt = Date.now();

  while (Date.now() < timeoutAt) {
    const hasRunningExecutions =
      Boolean(input.activeRefreshCycleId) ||
      input.widgetIds.some((widgetId) => input.getExecutionState(widgetId)?.status === "running");

    if (hasRunningExecutions) {
      lastBusyAt = Date.now();
    } else if (Date.now() - lastBusyAt > 1_000) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 200));
  }
}

export function useWorkspaceSnapshotCaptureController({
  dashboard,
  permissions,
  profile,
  resolvedDashboard,
}: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: string[];
  profile: WorkspaceSnapshotCaptureProfile;
}) {
  const controls = useDashboardControls();
  const execution = useDashboardWidgetExecution();
  const dependencyModel = useDashboardWidgetDependencies();
  const objectUrlRef = useRef<string | null>(null);
  const [snapshotState, setSnapshotState] = useState<CommandCenterSnapshotWindowState>({
    status: "idle",
  });
  const widgetIds = useMemo(
    () => resolvedDashboard.widgets.map((widget) => widget.id),
    [resolvedDashboard.widgets],
  );

  const startCapture = useCallback(async () => {
    if (!dependencyModel) {
      console.error("[workspace snapshot] capture failed", {
        workspaceId: dashboard.id,
        profile,
        error: "Workspace dependency model is not available for snapshot capture.",
      });

      const errorState: CommandCenterSnapshotWindowState = {
        status: "error",
        completedAt: new Date().toISOString(),
        workspaceId: dashboard.id,
        profile,
        error: "Workspace dependency model is not available for snapshot capture.",
      };

      setSnapshotState(errorState);
      publishSnapshotState(errorState);
      return errorState;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const startedAt = new Date().toISOString();
    const runningState: CommandCenterSnapshotWindowState = {
      status: "running",
      startedAt,
      workspaceId: dashboard.id,
      profile,
    };

    setSnapshotState(runningState);
    publishSnapshotState(runningState);

    try {
      await waitForWorkspaceToSettle({
        widgetIds,
        activeRefreshCycleId: execution?.activeRefreshCycleId,
        getExecutionState: (instanceId) => execution?.getExecutionState(instanceId),
      });
      await waitForNextFrame();
      await waitForNextFrame();

      const archive = await buildWorkspaceAgentSnapshotArchive({
        dashboard,
        resolvedDashboard,
        permissions,
        controlsState: {
          timeRangeKey: controls.timeRangeKey,
          rangeStartMs: controls.rangeStartMs,
          rangeEndMs: controls.rangeEndMs,
          refreshIntervalMs: controls.refreshIntervalMs,
          refreshProgress: controls.refreshProgress,
          isRefreshing: controls.isRefreshing,
          lastRefreshedAt: controls.lastRefreshedAt,
        },
        profile,
        resolveInputs: (instanceId) => dependencyModel.resolveInputs(instanceId),
      });

      const archiveUrl = URL.createObjectURL(archive.blob);

      objectUrlRef.current = archiveUrl;

      const readyState: CommandCenterSnapshotWindowState = {
        status: "ready",
        startedAt,
        completedAt: new Date().toISOString(),
        workspaceId: dashboard.id,
        profile,
        archiveName: archive.fileName,
        archiveUrl,
        archiveBlob: archive.blob,
        archiveSizeBytes: archive.blob.size,
        warnings: archive.warnings,
        errors: archive.errors,
      };

      if (archive.warnings.length > 0 || archive.errors.length > 0) {
        console.warn("[workspace snapshot] capture completed with warnings", {
          workspaceId: dashboard.id,
          profile,
          warnings: archive.warnings,
          errors: archive.errors,
        });
      }

      setSnapshotState(readyState);
      publishSnapshotState(readyState);
      return readyState;
    } catch (error) {
      console.error("[workspace snapshot] capture failed", {
        workspaceId: dashboard.id,
        profile,
        error,
      });

      const errorState: CommandCenterSnapshotWindowState = {
        status: "error",
        startedAt,
        completedAt: new Date().toISOString(),
        workspaceId: dashboard.id,
        profile,
        error:
          error instanceof Error
            ? error.message
            : "Workspace snapshot capture failed.",
      };

      setSnapshotState(errorState);
      publishSnapshotState(errorState);
      return errorState;
    }
  }, [
    controls.isRefreshing,
    controls.lastRefreshedAt,
    controls.rangeEndMs,
    controls.rangeStartMs,
    controls.refreshIntervalMs,
    controls.refreshProgress,
    controls.timeRangeKey,
    dashboard,
    dependencyModel,
    execution,
    permissions,
    profile,
    resolvedDashboard,
    widgetIds,
  ]);

  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  return {
    snapshotState,
    startCapture,
    downloadArchive: () => {
      if (snapshotState.status !== "ready" || !snapshotState.archiveUrl || !snapshotState.archiveName) {
        return;
      }

      downloadWorkspaceSnapshotArchive(snapshotState.archiveUrl, snapshotState.archiveName);
    },
  };
}

export function WorkspaceSnapshotCapture({
  dashboard,
  permissions,
  profile,
  resolvedDashboard,
}: {
  dashboard: DashboardDefinition;
  resolvedDashboard: ResolvedDashboardDefinition;
  permissions: string[];
  profile: WorkspaceSnapshotCaptureProfile;
}) {
  const { startCapture } = useWorkspaceSnapshotCaptureController({
    dashboard,
    resolvedDashboard,
    permissions,
    profile,
  });
  const autoRunKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const captureRunKey = `${dashboard.id}:${profile}`;

    if (autoRunKeyRef.current === captureRunKey) {
      return;
    }

    autoRunKeyRef.current = captureRunKey;
    void startCapture();
  }, [dashboard.id, profile, startCapture]);

  return null;
}
