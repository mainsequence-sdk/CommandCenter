import { Navigate, useLocation, useParams } from "react-router-dom";

export function LegacyDemoRedirect() {
  const { surfaceId } = useParams();
  const location = useLocation();
  const suffix = `${location.search}${location.hash}`;

  if (!surfaceId) {
    return <Navigate to={`/app/demo${suffix}`} replace />;
  }

  return <Navigate to={`/app/demo/${surfaceId}${suffix}`} replace />;
}
