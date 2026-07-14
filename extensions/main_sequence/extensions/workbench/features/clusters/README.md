# Clusters Feature

This feature contains the Cluster registry surface and the app-scoped cluster detail view for the Main Sequence extension.

## Files

- `MainSequenceClustersPage.tsx`: loads the cluster list from the pods API, applies server-side search and pagination, and opens detail in the Foundry surface with `msClusterUid`.
- `MainSequenceClusterDetailPage.tsx`: renders the `/app/main-sequence-foundry/clusters?msClusterUid=<uid>` detail state, fetches the standard `/summary/` payload for the header state, loads tab datasets on demand, and renders pod logs when `msClusterPodNamespace` and `msClusterPodName` are present.

## Notes

- Treat cluster tab browsing as read-only in this phase.
- The React detail state uses the canonical cluster `uid` returned by the pods API list endpoint, and that same identifier is reused for tab endpoints and pod logs navigation.
- The old `/clusters/:clusterUid` route is legacy-only and redirects into the Foundry app-scoped detail URL.
- The old `/clusters/:clusterUid/pods/:podName/logs/` route is legacy-only and redirects into the same Foundry cluster detail URL with `msClusterTab=pods` and `msClusterPodName`. If the legacy URL does not include `namespace`, the detail view can infer it only when the loaded pods table contains one matching namespace for that pod name.
- The header consumes the shared summary contract from `GET /orm/api/pods/cluster/{uid}/summary/`; cluster-specific values such as status, tabs, and active filters are read from `summary.extensions`.
- Pod log snapshots use `GET /orm/api/pods/cluster/{cluster_uid}/pod-logs/` with required `namespace` and `pod` query parameters. The response `logs` string is split into rows and rendered through the shared `LogTable` presentation.
