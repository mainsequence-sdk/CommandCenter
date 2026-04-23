import type { DashboardControlsState, ResolvedDashboardWidgetLayout } from "@/dashboards/types";
import type { DashboardWidgetDependencyGraph } from "@/dashboards/widget-dependencies";
import type { WidgetAgentSnapshot } from "@/widgets/types";

export type WorkspaceSnapshotCaptureProfile = "evidence" | "full-data";

export interface WorkspaceSnapshotFileManifestEntry {
  path: string;
  mediaType: string;
  sizeBytes: number;
  description?: string;
}

export interface WorkspaceAgentWidgetSnapshotRecord {
  instanceId: string;
  widgetId: string;
  title: string;
  category?: string;
  kind?: string;
  source?: string;
  placementMode: "canvas" | "sidebar";
  hidden: boolean;
  hiddenReason?: string;
  layout?: ResolvedDashboardWidgetLayout;
  parentRowId?: string;
  domTextContent?: string;
  artifactPaths: string[];
  snapshot: WidgetAgentSnapshot;
}

export interface WorkspaceAgentLiveState {
  schema: "mainsequence.workspace-agent-live-state";
  version: 1;
  generatedAt: string;
  profile: WorkspaceSnapshotCaptureProfile;
  workspaceId: string;
  workspaceTitle: string;
  view: "dashboard";
  controls: DashboardControlsState & {
    refreshProgress: number;
    isRefreshing: boolean;
    lastRefreshedAt: number | null;
  };
  relationshipGraph: DashboardWidgetDependencyGraph;
  widgets: WorkspaceAgentWidgetSnapshotRecord[];
  summary: {
    widgetCount: number;
    visibleWidgetCount: number;
    hiddenWidgetCount: number;
    relationshipEdgeCount: number;
  };
}

export interface WorkspaceSnapshotArchiveManifest {
  schema: "mainsequence.workspace-agent-archive";
  version: 1;
  generatedAt: string;
  profile: WorkspaceSnapshotCaptureProfile;
  workspaceId: string;
  workspaceTitle: string;
  fileCount: number;
  warnings: string[];
  errors: string[];
  entries: WorkspaceSnapshotFileManifestEntry[];
}

export interface BuiltWorkspaceSnapshotArchive {
  blob: Blob;
  fileName: string;
  manifest: WorkspaceSnapshotArchiveManifest;
  liveState: WorkspaceAgentLiveState;
  warnings: string[];
  errors: string[];
}

export interface CommandCenterSnapshotWindowState {
  status: "idle" | "running" | "ready" | "error";
  startedAt?: string;
  completedAt?: string;
  workspaceId?: string;
  profile?: WorkspaceSnapshotCaptureProfile;
  archiveName?: string;
  archiveUrl?: string;
  archiveBlob?: Blob;
  archiveSizeBytes?: number;
  manifest?: WorkspaceSnapshotArchiveManifest;
  liveState?: WorkspaceAgentLiveState;
  warnings?: string[];
  errors?: string[];
  error?: string;
}

declare global {
  interface Window {
    __COMMAND_CENTER_SNAPSHOT__?: CommandCenterSnapshotWindowState;
  }
}
