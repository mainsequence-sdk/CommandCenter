import { Download, LoaderCircle, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useDashboardWidgetDependencies } from "@/dashboards/DashboardWidgetDependencies";
import { useDashboardWidgetExecution } from "@/dashboards/DashboardWidgetExecution";
import type {
  DashboardDefinition,
  ResolvedDashboardDefinition,
} from "@/dashboards/types";

import { buildWorkspaceAgentSnapshotArchive } from "./archive";
import { waitForNextFrame } from "./capture";
import type {
  CommandCenterSnapshotWindowState,
  WorkspaceSnapshotCaptureProfile,
} from "./types";

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
        dependencyGraph: dependencyModel.graph,
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
        manifest: archive.manifest,
        liveState: archive.liveState,
        warnings: archive.warnings,
        errors: archive.errors,
      };

      if (archive.warnings.length > 0 || archive.errors.length > 0) {
        console.warn("[workspace snapshot] capture completed with warnings", {
          workspaceId: dashboard.id,
          profile,
          warnings: archive.warnings,
          errors: archive.errors,
          manifest: archive.manifest,
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

export function WorkspaceSnapshotStatusCard({
  snapshotState,
  profile,
}: {
  snapshotState: CommandCenterSnapshotWindowState;
  profile: WorkspaceSnapshotCaptureProfile;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[220] flex max-w-[420px] justify-end">
      <div className="pointer-events-auto rounded-[20px] border border-border/70 bg-card/92 px-4 py-3 shadow-[var(--shadow-panel)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {snapshotState.status === "running" ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          ) : snapshotState.status === "error" ? (
            <TriangleAlert className="h-4 w-4 text-danger" />
          ) : null}
          <Badge variant={snapshotState.status === "error" ? "warning" : "neutral"}>
            Snapshot {snapshotState.status}
          </Badge>
          <Badge variant="neutral">{profile}</Badge>
        </div>
        <div className="mt-2 max-w-[340px] text-sm text-muted-foreground">
          {snapshotState.status === "running"
            ? "Building live workspace archive from the mounted client runtime."
            : snapshotState.status === "ready"
              ? `Archive ready${snapshotState.archiveSizeBytes ? ` (${Math.round(snapshotState.archiveSizeBytes / 1024)} KB)` : ""}.`
              : snapshotState.error || "Snapshot capture failed."}
        </div>
      </div>
    </div>
  );
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
  const { snapshotState, startCapture, downloadArchive } =
    useWorkspaceSnapshotCaptureController({
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

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[220] flex max-w-[420px] justify-end">
      <div className="pointer-events-auto rounded-[20px] border border-border/70 bg-card/92 px-4 py-3 shadow-[var(--shadow-panel)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {snapshotState.status === "running" ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          ) : snapshotState.status === "error" ? (
            <TriangleAlert className="h-4 w-4 text-danger" />
          ) : null}
          <Badge variant={snapshotState.status === "error" ? "warning" : "neutral"}>
            Snapshot {snapshotState.status}
          </Badge>
          <Badge variant="neutral">{profile}</Badge>
        </div>
        <div className="mt-2 max-w-[340px] text-sm text-muted-foreground">
          {snapshotState.status === "running"
            ? "Building live workspace archive from the mounted client runtime."
            : snapshotState.status === "ready"
              ? `Archive ready${snapshotState.archiveSizeBytes ? ` (${Math.round(snapshotState.archiveSizeBytes / 1024)} KB)` : ""}.`
              : snapshotState.error || "Snapshot capture failed."}
        </div>
        {snapshotState.status === "ready" && snapshotState.archiveUrl && snapshotState.archiveName ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button size="sm" onClick={downloadArchive}>
              <Download className="h-4 w-4" />
              Download archive
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
