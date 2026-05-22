# Data Nodes Feature

This feature owns DynamicTableMetaData and LocalTimeSerie update workflows.

## Files

- `MainSequenceDataNodesPage.tsx`: registry page for data nodes. It also owns the top-level detail tabs for summary, description, data snapshot, policies, permissions, and local-update navigation.
- `MainSequenceDataNodeSnapshotTab.tsx`: detail-tab wrapper that loads the latest tail observations for the selected data node and renders a searchable preview table.
- `MainSequenceDataNodeLocalTimeSeriesTab.tsx`: local time series listing and interactions for a selected data node.
- `MainSequenceDataNodeLocalUpdateDetail.tsx`: local update detail surface with tabs for details, graphs, history, and logs.
- `MainSequenceDataNodePoliciesTab.tsx`: policy-oriented controls and displays for a data node.
- `MainSequenceLocalUpdateDependencyGraph.tsx`: feature wrapper that binds the reusable dependency-graph renderer to the LocalTimeSerie graph endpoint.

## Notes

- Keep reusable graph and inspector subcomponents here if they are specific to data nodes. Shared dependency-graph rendering now lives under `../../widgets/dependency-graph/`.
- The data-snapshot tab intentionally uses the lightweight tail-observations preview endpoint (`dynamic_table/{uid}/get-tail-observations/?n=100&order=desc`) instead of the older latest-observation plus point-range query chain, because the registry detail surface does not have a canonical upstream `Data Node` widget runtime to bind against.
- Data-node permissions use the shared `MainSequencePermissionsTab`, but they target the absolute `ts_manager/dynamic_table` object root instead of the default pods-scoped permission paths used by projects, constants, and secrets.
- If a piece becomes useful outside this feature, move it to `../../components` and update this README.
- Data-node detail navigation is URL-backed: `msDataNodeTab` selects the top-level detail tab, while `msLocalUpdateUid` and `msLocalUpdateTab` drive the nested local-update detail view.
- The surface also accepts standalone local-update deep links with `msLocalUpdateUid` even when `msDataNodeUid` is absent; this is used by cross-app links from Markets portfolio summaries.
- The detail header exposes a `Delete Tail Data` action. It loads SourceTableConfiguration stats for multi-index tables, lets the user scope the delete to selected identifiers, and sends the suffix delete through `dynamic_table/<uid>/delete_after_date/`.
- URL-backed detail navigation stores the backend ts_manager `uid` for both Data Nodes and nested local updates.
- Local-update run configuration uses the shared Main Sequence resource-requirements block for
  CPU/GPU requirements, keeping resource controls separate from retry, timeout, and schedule
  controls. The same block exposes the shared billing estimate action with zero memory and standard
  capacity because this backend contract only exposes CPU/GPU requirements for local updates.
- The data-node summary header decorates the summary `engine` field with the canonical source icon
  from the detail payload (`data_source.related_resource_class_type`). The summary endpoint still
  provides the display label, while the detail endpoint supplies the stable class type used for the
  icon mapping.
- The `TimeScale Policies` tab is only exposed for data nodes whose canonical source class resolves
  to a Timescale engine (`timescale_db` or `timescale_db_remote`). Deep links to
  `msDataNodeTab=policies` fall back to the default detail tab when the selected data node is not
  Timescale-backed.
