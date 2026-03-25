import { Navigate, useParams } from "react-router-dom";

import { TeamDetailPage } from "@/features/teams/TeamDetailPage";
import { teamsRegistryPath } from "@/features/teams/shared";

import { AccessRbacSurfaceLayout } from "./shared";

export function AccessRbacTeamDetailPage() {
  const { teamId } = useParams();
  const numericTeamId = Number(teamId);

  if (!Number.isFinite(numericTeamId) || numericTeamId <= 0) {
    return <Navigate to={teamsRegistryPath} replace />;
  }

  return (
    <AccessRbacSurfaceLayout
      title="Team details"
      description="Review team policies and membership in a focused detail view."
      surfaceId="teams"
    >
      <TeamDetailPage teamId={numericTeamId} />
    </AccessRbacSurfaceLayout>
  );
}
