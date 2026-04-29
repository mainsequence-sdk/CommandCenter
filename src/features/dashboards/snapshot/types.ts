import type { ResolvedDashboardWidgetLayout } from "@/dashboards/types";
import type { WidgetAgentSnapshot } from "@/widgets/types";

export type WorkspaceSnapshotCaptureProfile = "agent";

export interface WorkspaceAgentWidgetSnapshotRecord {
  instanceId: string;
  widgetName: string;
  widgetType: string;
  source?: string;
  connectionTypeName?: string;
  placementMode: "canvas" | "sidebar";
  hidden: boolean;
  hiddenReason?: string;
  layout?: ResolvedDashboardWidgetLayout;
  parentRowId?: string;
  snapshot: WidgetAgentSnapshot;
}

export interface BuiltWorkspaceSnapshotArchive {
  blob: Blob;
  fileName: string;
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
  warnings?: string[];
  errors?: string[];
  error?: string;
}

declare global {
  interface Window {
    __COMMAND_CENTER_SNAPSHOT__?: CommandCenterSnapshotWindowState;
  }
}
