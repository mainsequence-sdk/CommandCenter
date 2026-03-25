# Data Nodes Feature

This feature owns DynamicTableMetaData and LocalTimeSerie update workflows.

## Files

- `MainSequenceDataNodesPage.tsx`: registry page for data nodes. It also owns the top-level detail tabs for summary, description, policies, and local-update navigation.
- `MainSequenceDataNodeLocalTimeSeriesTab.tsx`: local time series listing and interactions for a selected data node.
- `MainSequenceDataNodeLocalUpdateDetail.tsx`: local update detail surface with tabs for details, graphs, history, and logs.
- `MainSequenceDataNodePoliciesTab.tsx`: policy-oriented controls and displays for a data node.
- `MainSequenceLocalUpdateDependencyGraph.tsx`: feature wrapper that binds the reusable dependency-graph renderer to the LocalTimeSerie graph endpoint.

## Notes

- Keep reusable graph and inspector subcomponents here if they are specific to data nodes. Shared dependency-graph rendering now lives under `../../widgets/dependency-graph/`.
- If a piece becomes useful outside this feature, move it to `../../components` and update this README.
- Data-node detail navigation is URL-backed: `msDataNodeTab` selects the top-level detail tab, while `msLocalUpdateId` and `msLocalUpdateTab` drive the nested local-update detail view.
- The surface also accepts standalone local-update deep links with `msLocalUpdateId` even when `msDataNodeId` is absent; this is used by cross-app links from Markets portfolio summaries.
