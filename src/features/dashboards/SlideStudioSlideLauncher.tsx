import { Plus } from "lucide-react";

import { useToast } from "@/components/ui/toaster";
import { workspaceSlideWidget } from "@/widgets/core/workspace-slide/definition";

import { WorkspaceToolbarButton } from "./WorkspaceChrome";
import { appendCatalogWidget } from "./custom-dashboard-storage";
import { useCustomWorkspaceStudio } from "./useCustomWorkspaceStudio";

export function SlideStudioSlideLauncher() {
  const { toast } = useToast();
  const {
    selectedDashboard,
    setSelectedWorkspaceEditing,
    updateSelectedWorkspace,
  } = useCustomWorkspaceStudio();

  const disabled = !selectedDashboard;

  return (
    <WorkspaceToolbarButton
      title="Add slide"
      disabled={disabled}
      onClick={() => {
        if (!selectedDashboard) {
          return;
        }

        setSelectedWorkspaceEditing(true);
        updateSelectedWorkspace((dashboard) => appendCatalogWidget(dashboard, workspaceSlideWidget));

        toast({
          title: "Slide added",
          description: "Inserted a new slide onto the current deck canvas.",
          variant: "success",
        });
      }}
    >
      <Plus className="h-3.5 w-3.5" />
    </WorkspaceToolbarButton>
  );
}
