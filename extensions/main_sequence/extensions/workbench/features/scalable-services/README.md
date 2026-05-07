# Scalable Services Feature

This feature owns the read-only scalable deployment service registry in Main Sequence Foundry.

## Entry Points

- `MainSequenceScalableServicesPage.tsx`: registry page with search, pagination, and URL-backed detail routing.
- `MainSequenceScalableServiceDetail.tsx`: summary-backed detail shell with the `Pods` tab for the selected scalable service.
- `MainSequenceKnativePodRuntimeDetail.tsx`: nested pod-runtime detail shell, similar to job-run detail, with `Logs` and `Resource Usage` tabs.
- `MainSequenceKnativePodRuntimeLogsTab.tsx`: log-table presentation for `knative-pod-runtimes/{id}/logs/`.

## API Dependencies

- `GET /orm/api/pods/scalable-service/` for the read-only list view.
- `GET /orm/api/pods/scalable-service/{id}/summary/` for the standardized summary header.
- `GET /orm/api/pods/scalable-service/{id}/pods/` for the `Pods` tab. This endpoint returns a
  plain array of scalable-service pod runtime rows, not the generic cluster-pod serializer and not
  a paginated payload.
- `GET /orm/api/pods/knative-pod-runtimes/{id}/logs/` for pod-runtime logs.
- `GET /orm/api/pods/knative-pod-runtimes/{id}/resource-usage/` for pod-runtime resource usage.

## Notes

- This feature is intentionally read-only until Foundry gets explicit scalable-service mutation flows.
- Detail routing is URL-backed with:
  - `msScalableServiceId`
  - `msScalableServiceTab`
  - `msScalableServicePodRuntimeId`
  - `msScalableServicePodRuntimeTab`
  so selected services, pod runtimes, and tabs are linkable and refresh-safe.
- Keep the header summary sourced from the scalable-service `/summary/` endpoint instead of synthesizing local card data.
- The `Pods` tab should render the actual scalable-service pod runtime contract directly:
  `gke_pod_name`, `status`, `service_runtime`, `revision_runtime`, `pod_uid`, `creation_date`,
  and `last_seen_at`. Do not reuse the generic cluster-pod columns here.
- Pod-runtime detail intentionally stays nested under the scalable-service detail shell instead of
  becoming a separate top-level Foundry surface.
- The surface is intentionally hidden from normal Foundry navigation. It currently exists as an
  internal deep-link target for runtime lookups from other screens, not as a browsable registry
  entry.
