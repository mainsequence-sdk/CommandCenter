import { Play } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { WorkspaceToolbarButton } from "./WorkspaceChrome";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";

export function SlideStudioPresentLauncher() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedDashboard } = useCustomWorkspaceStudio();

  return (
    <WorkspaceToolbarButton
      title="Present"
      disabled={!selectedDashboard}
      onClick={() => {
        if (!selectedDashboard) {
          return;
        }

        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("workspace", selectedDashboard.id);
        nextParams.set("mode", "slideshow");
        nextParams.delete("view");
        nextParams.delete("widget");
        nextParams.delete("tab");
        nextParams.delete("slide");
        setSearchParams(nextParams);
      }}
    >
      <Play className="h-3.5 w-3.5" />
    </WorkspaceToolbarButton>
  );
}
