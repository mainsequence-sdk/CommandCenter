# Scalable Services Feature

This feature owns the scalable-service detail shell in Main Sequence Foundry.

## Entry Points

- `MainSequenceScalableServicesPage.tsx`: internal deep-link entry that requires
  `msScalableServiceUid` and routes into the detail shell. It is not a browsable registry page.
- `MainSequenceScalableServiceDetail.tsx`: summary-backed detail shell with the `Pods` and `Revisions` tabs for the selected scalable service.
- `MainSequenceKnativePodRuntimeDetail.tsx`: nested pod-runtime detail shell, similar to job-run detail, with `Logs` and `Resource Usage` tabs. The file name tracks the backend route lineage; UI copy uses Service Runtime wording.
- `MainSequenceKnativePodRuntimeLogsTab.tsx`: log-table presentation for `knative-pod-runtimes/{uid}/logs/`. The route name is backend-owned; user-facing labels stay generic.

## API Dependencies

- `GET /orm/api/pods/scalable-service/{uid}/summary/` for the standardized summary header.
- `GET /orm/api/pods/scalable-service/{uid}/pods/` for the `Pods` tab. This endpoint returns a
  plain array of scalable-service pod runtime rows, not the generic cluster-pod serializer and not
  a paginated payload.
- `GET /orm/api/pods/scalable-service/{uid}/revisions/` for the `Revisions` tab.
- `GET /orm/api/pods/knative-pod-runtimes/{uid}/logs/` for pod-runtime logs.
- `GET /orm/api/pods/knative-pod-runtimes/{uid}/resource-usage/` for pod-runtime resource usage.

## Notes

- This feature is intentionally read-only until Foundry gets explicit scalable-service mutation flows.
- Detail routing is URL-backed with:
  - `msScalableServiceUid`
  - `msScalableServiceTab`
  - `msScalableServicePodRuntimeUid`
  - `msScalableServicePodRuntimeTab`
  so selected services, pod runtimes, and tabs are linkable and refresh-safe.
- The surface does not expose a scalable-service list view. If opened without `msScalableServiceUid`,
  it redirects to the Foundry projects surface.
- Keep the header summary sourced from the scalable-service `/summary/` endpoint instead of synthesizing local card data.
- The `Pods` tab should render the actual scalable-service pod runtime contract directly:
  `gke_pod_name`, `status`, `service_runtime`, `revision_runtime`, `pod_uid`, `creation_date`,
  and `last_seen_at`. Do not reuse the generic cluster-pod columns here.
- The `Revisions` tab should stay wired directly to the scalable-service revisions endpoint rather
  than pretending there is a standalone scalable-services registry flow behind it.
- Pod-runtime detail intentionally stays nested under the scalable-service detail shell instead of
  becoming a separate top-level Foundry surface.
- The surface is intentionally hidden from normal Foundry navigation. It currently exists as an
  internal deep-link target for runtime lookups from other screens, not as a browsable registry
  entry.
