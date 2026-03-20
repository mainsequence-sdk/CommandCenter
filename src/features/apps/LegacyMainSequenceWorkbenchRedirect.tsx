import { Navigate, useLocation, useParams } from "react-router-dom";

export function LegacyMainSequenceWorkbenchRedirect() {
  const { surfaceId } = useParams();
  const location = useLocation();
  const suffix = `${location.search}${location.hash}`;

  if (!surfaceId) {
    return <Navigate to={`/app/main_sequence_workbench${suffix}`} replace />;
  }

  return <Navigate to={`/app/main_sequence_workbench/${surfaceId}${suffix}`} replace />;
}
