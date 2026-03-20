import { Navigate, useParams } from "react-router-dom";

import { getDashboardSurfaceByDashboardId } from "@/app/registry";
import { getAppPath } from "@/apps/utils";

export function LegacyDashboardRedirect() {
  const { dashboardId } = useParams();
  const surface = dashboardId ? getDashboardSurfaceByDashboardId(dashboardId) : undefined;

  if (!surface) {
    return <Navigate to="/app" replace />;
  }

  return <Navigate to={getAppPath(surface.appId, surface.id)} replace />;
}
