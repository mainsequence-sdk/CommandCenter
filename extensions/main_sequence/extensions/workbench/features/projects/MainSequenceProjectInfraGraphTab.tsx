import { MainSequenceProjectInfraGraph } from "../../widgets/project-infra-graph/MainSequenceProjectInfraGraph";

export function MainSequenceProjectInfraGraphTab({
  projectId,
}: {
  projectId: number;
}) {
  return <MainSequenceProjectInfraGraph projectId={projectId} />;
}
