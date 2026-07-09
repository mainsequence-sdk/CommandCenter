import { Navigate, useParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { TeamDetailPage } from "@/features/teams/TeamDetailPage";
import { teamsRegistryPath } from "@/features/teams/shared";

import { AccessRbacSurfaceLayout } from "./shared";

export function AccessRbacTeamDetailPage() {
  const { teamId } = useParams();
  const shellAccess = useAuthStore((state) => state.session?.user.shellAccess);
  const numericTeamId = Number(teamId);
  const canOpenTeams = Boolean(
    shellAccess?.accessibleApps.includes("settings.access-rbac") &&
      shellAccess?.accessibleSurfaces.includes("settings.access-rbac.teams"),
  );

  if (!canOpenTeams) {
    return <Navigate to="/app/settings" replace />;
  }

  if (!Number.isFinite(numericTeamId) || numericTeamId <= 0) {
    return <Navigate to={teamsRegistryPath} replace />;
  }

  return (
    <AccessRbacSurfaceLayout
      title="Team details"
      description="Review team policies and membership in a focused detail view."
    >
      <TeamDetailPage teamId={numericTeamId} />
    </AccessRbacSurfaceLayout>
  );
}
