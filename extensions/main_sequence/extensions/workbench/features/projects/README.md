# Projects Feature

This feature owns the Main Sequence project registry and project detail experience.

## Files

- `MainSequenceProjectsPage.tsx`: project registry page and project detail shell.
- `MainSequenceProjectCodeTab.tsx`: repository browser and code preview tab.
- `MainSequenceProjectInfraGraphTab.tsx`: project-scoped infrastructure graph tab wrapper.
- `MainSequenceCreateJobDialog.tsx`: dialog for creating a job from a repository file.
- `MainSequenceProjectImagesTab.tsx`: project image listing and related image state.
- `MainSequenceProjectJobsTab.tsx`: project-scoped jobs tab.
- `MainSequenceProjectResourceReleasesTab.tsx`: resource release tab for projects.
- `MainSequenceResourceReleaseApiTestTab.tsx`: developer-focused FastAPI release tester that reuses the shared AppComponent OpenAPI explorer and request runner.
- `MainSequenceProjectSettingsTab.tsx`: project settings tab with the data source/base image pickers used by project creation plus project-secret assignment controls.
- `MainSequenceJobRunsTab.tsx`: run listing within the project context.
- `MainSequenceJobRunLogsTab.tsx`: logs tab for selected job runs.
- `MainSequenceJobRunResourceUsageSection.tsx`: run resource-usage display block.

## Notes

- Project-only tabs and dialogs should remain here even when they are large.
- The active project detail tabs are `Code`, `Infra Graph`, `Jobs`, `Images`, `Resource Releases`, `Data Nodes Updates`, `Settings`, and `Permissions`.
- Shared registry controls should stay in `../../components`.
- The selected-job detail view in the `Jobs` tab exposes a direct `Run Job` action that posts to `job/{id}/run_job/` and refreshes the run list after success.
- The selected run `Logs` tab normalizes structured backend rows into the shared `LogTable`
  contract so expanded log details can show fields like `filename`, `lineno`, `func_name`, and
  any extra structured context returned by the backend.
- The settings tab reuses the shared project form-options query and writes through the project detail `PATCH` endpoint.
- Project permissions use the shared `MainSequencePermissionsTab` against the standard shareable-object project endpoints.
- The infra graph tab is backed by the dedicated `widgets/project-infra-graph/` module. That module also powers the reusable workspace widget definition, so project-tab changes should keep the compact widget variant working too. It follows the backend link contract directly: click inspects via `summary_url`, and `Explore graph` drills down via `graph_url`. The graph presentation is intentionally project-centric, with the project node centered and the rest of the infrastructure arranged radially instead of in column lanes.
- The resource releases tab supports project resource release creation flows for dashboard, agent, and fastapi release kinds.
- FastAPI resource release details now expose a `Test API` tab. It reuses the shared AppComponent schema explorer and request-form runner, but keeps the output intentionally raw and developer-oriented.
- When the selected FastAPI response advertises AppComponent response-notification metadata, that
  `Test API` tab now also shows the same notification preview above the raw response body. The raw
  payload still stays visible for transport debugging.
- The `Test API` tab is gated strictly from `resource_type` in the resource release summary payload, not from badge labels or other presentation-only fields.
- Schema-load and request failures in that tab now report the target URL, auth mode, JWT-attachment state, and whether the browser used the local loopback proxy or a direct cross-origin fetch.
- The `Test API` tab now runs through the same Main Sequence resource-release transport as the
  AppComponent widget. For FastAPI releases, it first calls the resource-release
  `exchange-launch` endpoint, then sends the public FastAPI request with the returned launch token
  plus `X-FastAPI-ID`. It no longer relies on the generic AppComponent session-JWT transport for
  those public API calls.
- The tab still exposes the same additional-header editor as AppComponent settings, but the
  transport-owned `Authorization` and `X-FastAPI-ID` headers win over any user-configured header
  entries.
- The project registry polls every 60 seconds only while the current page still contains an uninitialized project, and those rows render a spinner instead of a warning pill.
- The project images tab polls every 60 seconds only while the current page still contains a building image, and those rows render a spinner instead of a warning pill.
- The create-project dialog auto-selects the first available data source and default base image once form options load.
