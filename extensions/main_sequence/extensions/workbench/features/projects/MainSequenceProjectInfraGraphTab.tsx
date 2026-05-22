import { MainSequenceProjectInfraGraph } from "../../widgets/project-infra-graph/MainSequenceProjectInfraGraph";

export function MainSequenceProjectInfraGraphTab({
  projectUid,
}: {
  projectUid: string;
}) {
  return <MainSequenceProjectInfraGraph projectUid={projectUid} />;
}
