import { useMemo } from "react";

import { SlideStudioSlideLauncher } from "./SlideStudioSlideLauncher";
import { WorkspacesPage } from "./WorkspacesPage";
import { slideStudioWorkspaceStudioConfig } from "./slide-studio-workspaces";
import { WorkspaceStudioSurfaceConfigProvider } from "./workspace-studio-surface-config";

export function SlideStudioPage() {
  const surfaceConfig = useMemo(
    () => ({
      ...slideStudioWorkspaceStudioConfig,
      toolbarActions: <SlideStudioSlideLauncher />,
    }),
    [],
  );

  return (
    <WorkspaceStudioSurfaceConfigProvider value={surfaceConfig}>
      <WorkspacesPage />
    </WorkspaceStudioSurfaceConfigProvider>
  );
}
