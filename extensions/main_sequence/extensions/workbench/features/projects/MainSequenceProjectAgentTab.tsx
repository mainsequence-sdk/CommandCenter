import { ProjectAgentConfigurator } from "../../../../../main_sequence_ai/features/project-agents/ProjectAgentConfigurator";

export function MainSequenceProjectAgentTab({
  projectId,
  hasAgentCapabilities,
  onOpenImagesTab,
}: {
  projectId: number;
  hasAgentCapabilities: boolean | null;
  onOpenImagesTab: () => void;
}) {
  return (
    <ProjectAgentConfigurator
      projectId={projectId}
      hasAgentCapabilities={hasAgentCapabilities}
      onOpenImagesTab={onOpenImagesTab}
    />
  );
}
