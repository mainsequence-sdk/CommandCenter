import { TeamsPage } from "@/features/teams/TeamsPage";

import { AccessRbacSurfaceLayout } from "./shared";

export function AccessRbacTeamsPage() {
  return (
    <AccessRbacSurfaceLayout
      title="Teams"
      description="Manage organization teams, memberships, and team sharing as part of Access & RBAC."
    >
      <TeamsPage embedded />
    </AccessRbacSurfaceLayout>
  );
}
