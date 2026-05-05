import { Printer } from "lucide-react";

import { WorkspaceToolbarButton } from "./WorkspaceChrome";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";
import {
  buildWorkspaceStudioModePath,
  useWorkspaceStudioSurfaceConfig,
} from "./workspace-studio-surface-config";

export function SlideStudioPrintLauncher() {
  const { selectedDashboard } = useCustomWorkspaceStudio();
  const { workspaceListPath } = useWorkspaceStudioSurfaceConfig();

  return (
    <WorkspaceToolbarButton
      title="Export PDF"
      disabled={!selectedDashboard}
      onClick={() => {
        if (!selectedDashboard || typeof window === "undefined") {
          return;
        }

        const path = buildWorkspaceStudioModePath(
          workspaceListPath,
          selectedDashboard.id,
          "print",
        );

        const openedWindow = window.open(path, "_blank", "noopener,noreferrer");

        if (!openedWindow) {
          window.location.assign(path);
        }
      }}
    >
      <Printer className="h-3.5 w-3.5" />
    </WorkspaceToolbarButton>
  );
}
