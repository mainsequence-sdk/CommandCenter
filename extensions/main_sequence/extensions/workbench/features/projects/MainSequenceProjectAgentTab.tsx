import { ProjectAgentConfigurator } from "../../../../../main_sequence_ai/features/project-agents/ProjectAgentConfigurator";

export function MainSequenceProjectAgentTab({
  projectUid,
  hasAgentCapabilities,
}: {
  projectUid: string;
  hasAgentCapabilities: boolean | null;
}) {
  return (
    <ProjectAgentConfigurator
      projectUid={projectUid}
      hasAgentCapabilities={hasAgentCapabilities}
    />
  );
}
