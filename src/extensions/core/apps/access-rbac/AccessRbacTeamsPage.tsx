import { TeamsPage } from "@/features/teams/TeamsPage";

import { AccessRbacSurfaceLayout } from "./shared";

export function AccessRbacTeamsPage() {
  return (
    <AccessRbacSurfaceLayout
      title="Teams"
      description="Browse organization teams and open a dedicated detail view for policies and membership."
    >
      <TeamsPage embedded />
    </AccessRbacSurfaceLayout>
  );
}
