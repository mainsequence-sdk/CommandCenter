import { Navigate, useParams } from "react-router-dom";

import { getSurfaceById } from "@/app/registry";
import { getAppPath } from "@/apps/utils";

export function LegacyWorkspaceRedirect() {
  const { workspaceId } = useParams();
  const surface = workspaceId ? getSurfaceById(workspaceId) : undefined;

  if (!surface) {
    return <Navigate to="/app" replace />;
  }

  return <Navigate to={getAppPath(surface.appId, surface.id)} replace />;
}
