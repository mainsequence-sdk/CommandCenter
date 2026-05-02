import { useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import { SlideStudioPresentLauncher } from "./SlideStudioPresentLauncher";
import { SlideStudioSlideLauncher } from "./SlideStudioSlideLauncher";
import { SlideStudioSlideshowPage } from "./SlideStudioSlideshowPage";
import { WorkspacesPage } from "./WorkspacesPage";
import { slideStudioWorkspaceStudioConfig } from "./slide-studio-workspaces";
import { WorkspaceStudioSurfaceConfigProvider } from "./workspace-studio-surface-config";

export function SlideStudioPage() {
  const [searchParams] = useSearchParams();
  const slideshowMode = searchParams.get("mode") === "slideshow";
  const surfaceConfig = useMemo(
    () => ({
      ...slideStudioWorkspaceStudioConfig,
      toolbarActions: (
        <>
          <SlideStudioSlideLauncher />
          <SlideStudioPresentLauncher />
        </>
      ),
    }),
    [],
  );

  return (
    <WorkspaceStudioSurfaceConfigProvider value={surfaceConfig}>
      {slideshowMode ? <SlideStudioSlideshowPage /> : <WorkspacesPage />}
    </WorkspaceStudioSurfaceConfigProvider>
  );
}
