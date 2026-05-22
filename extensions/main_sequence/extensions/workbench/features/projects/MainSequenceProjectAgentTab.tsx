import { ProjectAgentConfigurator } from "../../../../../main_sequence_ai/features/project-agents/ProjectAgentConfigurator";

export function MainSequenceProjectAgentTab({
  projectUid,
  hasAgentCapabilities,
  onOpenImagesTab,
}: {
  projectUid: string;
  hasAgentCapabilities: boolean | null;
  onOpenImagesTab: () => void;
}) {
  return (
    <ProjectAgentConfigurator
      projectUid={projectUid}
      hasAgentCapabilities={hasAgentCapabilities}
      onOpenImagesTab={onOpenImagesTab}
    />
  );
}
