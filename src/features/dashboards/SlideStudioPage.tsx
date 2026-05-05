import { useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import { SlideStudioPresentLauncher } from "./SlideStudioPresentLauncher";
import { SlideStudioPrintLauncher } from "./SlideStudioPrintLauncher";
import { SlideStudioPrintPage } from "./SlideStudioPrintPage";
import { SlideStudioSlideLauncher } from "./SlideStudioSlideLauncher";
import { SlideStudioSlideshowPage } from "./SlideStudioSlideshowPage";
import { WorkspacesPage } from "./WorkspacesPage";
import { slideStudioWorkspaceStudioConfig } from "./slide-studio-workspaces";
import { WorkspaceStudioSurfaceConfigProvider } from "./workspace-studio-surface-config";

export function SlideStudioPage() {
  const [searchParams] = useSearchParams();
  const slideshowMode = searchParams.get("mode") === "slideshow";
  const printMode = searchParams.get("mode") === "print";
  const surfaceConfig = useMemo(
    () => ({
      ...slideStudioWorkspaceStudioConfig,
      toolbarActions: (
        <>
          <SlideStudioSlideLauncher />
          <SlideStudioPresentLauncher />
          <SlideStudioPrintLauncher />
        </>
      ),
    }),
    [],
  );

  return (
    <WorkspaceStudioSurfaceConfigProvider value={surfaceConfig}>
      {slideshowMode ? (
        <SlideStudioSlideshowPage />
      ) : printMode ? (
        <SlideStudioPrintPage />
      ) : (
        <WorkspacesPage />
      )}
    </WorkspaceStudioSurfaceConfigProvider>
  );
}
