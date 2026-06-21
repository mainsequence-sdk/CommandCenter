# Clusters Feature

This feature contains the Cluster registry surface and the direct cluster detail route for the Main Sequence extension.

## Files

- `MainSequenceClustersPage.tsx`: loads the cluster list from the pods API, applies server-side search and pagination, and routes into the canonical cluster-uid detail page.
- `MainSequenceClusterDetailPage.tsx`: renders the `/clusters/:clusterUid` detail route, fetches the standard `/summary/` payload for the header state, and loads tab datasets on demand.

## Notes

- Treat cluster tab browsing as read-only in this phase.
- The React detail route uses the canonical cluster `uid` returned by the pods API list endpoint, and that same identifier is reused for tab endpoints and pod logs navigation.
- The header consumes the shared summary contract from `GET /orm/api/pods/cluster/{uid}/summary/`; cluster-specific values such as status, tabs, and active filters are read from `summary.extensions`.
