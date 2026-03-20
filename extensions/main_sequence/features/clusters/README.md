# Clusters Feature

This feature contains the Cluster registry surface and the direct cluster detail route for the Main Sequence extension.

## Files

- `MainSequenceClustersPage.tsx`: loads the cluster list from the pods API, applies server-side search and pagination, and routes into the numeric-id cluster detail page.
- `MainSequenceClusterDetailPage.tsx`: renders the `/clusters/:clusterId` detail route, fetches the summary payload, and loads tab datasets on demand.

## Notes

- Treat cluster tab browsing as read-only in this phase, except for the header scale action.
- The React detail route uses the numeric database id as the canonical identifier. UUID is only retained for the pod logs link path.
