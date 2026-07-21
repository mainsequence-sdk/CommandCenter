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
- `MainSequenceProjectDeployHistoryTab.tsx`: project-scoped static-site deployment history tab.
- `MainSequenceResourceReleaseApiTestTab.tsx`: developer-focused FastAPI release tester that reuses the shared AppComponent OpenAPI explorer and request runner.
- `MainSequenceProjectSettingsTab.tsx`: project settings tab with the data source/base image pickers used by project creation plus project-secret assignment controls.
- `MainSequenceJobRunsTab.tsx`: run listing within the project context.
- `MainSequenceJobRunLogsTab.tsx`: logs tab for selected job runs.
- `MainSequenceJobRunResourceUsageSection.tsx`: run resource-usage display block.

## Notes

- Project-only tabs and dialogs should remain here even when they are large.
- The active project detail tabs are `Code`, `Infra Graph`, `Jobs`, `Images`, `Resource Releases`, `Data Nodes Updates`, `Deploy History`, `Settings`, and `Permissions`.
- Shared registry controls should stay in `../../components`.
- The selected-job detail view in the `Jobs` tab exposes a direct `Run Job` action that posts to `job/{uid}/run_job/` and refreshes the run list after success. Users may optionally enter command-style arguments beside the action; the UI tokenizes that input and sends it as the backend `command_args: string[]` payload.
- Job run list and detail surfaces display `command_args` returned by the job-run serializer so manual run parameters remain visible after launch.
- The selected run `Logs` tab normalizes structured backend rows into the shared `LogTable`
  contract so expanded log details can show fields like `filename`, `lineno`, `func_name`, and
  any extra structured context returned by the backend.
- The settings tab reuses the shared project form-options query and writes through the project detail `PATCH` endpoint.
- Project create and settings data-source selectors use `MainSequenceDataSourcePickerField` with
  the shared data-source picker option builders, so project data-source choices always include the
  resolved physical data-source icon plus consistent class/status metadata.
- Project permissions use the shared `MainSequencePermissionsTab` against the standard shareable-object project endpoints.
- The infra graph tab is backed by the dedicated `widgets/project-infra-graph/` module. That module also powers the reusable workspace widget definition, so project-tab changes should keep the compact widget variant working too. It follows the backend link contract directly: click inspects via `summary_url`, and `Explore graph` drills down via `graph_url`. The graph presentation is intentionally project-centric, with the project node centered and the rest of the infrastructure arranged radially instead of in column lanes.
- The resource releases tab supports project resource release creation flows for dashboard, agent,
  fastapi, and static-site release kinds.
- Generic resource release creation sends the UID-only backend contract with `resource_uid`,
  `related_image_uid`, compute fields, and the single boolean `automatic_deployment` policy. The
  UI renders `automatic_deployment` as a boolean and must not add deployment modes, tracked-path
  selectors, or current-version tracking selectors.
- Static-site release creation is capability-gated through
  `/orm/api/pods/resource-release/static-site-capabilities/`. The create request maps
  `creation.fields[].name` to the user-selected effective value, renders each field's `help_text`,
  omits disabled fields, and must not send capability descriptors, schema/catalog metadata,
  availability, features, or limits. The current creation surface uses the returned
  `spa_entry_file` field for SPA routing and does not render or submit removed command/fallback
  fields. Static sites do not select project resources, project images, jobs, or compute requests.
- Resource release details include a `Deployment` tab. That tab edits only
  `automatic_deployment`, keeps `uid`, `subdomain`, `resource_uid`, `readme_resource_uid`,
  `related_job_uid`, and `release_kind` read-only, and exposes `Deploy current version` as a
  separate manual rotation action that works even when automatic deployment is disabled.
- Resource release deployment run history reads
  `/orm/api/pods/deployment-runs/?project_uid=<project_uid>&target_type=resource_release` and
  filters the returned rows client-side by `target.uid` for the selected release. Rows render
  `state`, `phase`, `source`, `target.kind`, `commit_sha`, and the unified `error` payload.
- The project `Deploy History` tab is project-scoped through
  `/orm/api/pods/deployment-runs/?project_uid=<project_uid>`. The tab can filter by
  `resource_release`, `project_executor`, or `static_site`, opens details through
  `/orm/api/pods/deployment-runs/{run_uid}/`, and opens logs through
  `/orm/api/pods/deployment-runs/{run_uid}/logs/`.
- Static-site release details use the entity summary as their complete overview and expose only the
  separate `Permissions` tab below it; do not duplicate summary fields in another overview panel.
- A static-site summary `public_url` field with `kind: "link"`, `href`, and `iframe: true`
  opens the full Foundry content area in a temporary iframe viewer. Every activation fetches a new
  exchange URL from `href` through the authenticated Main Sequence client, validates
  `release_kind: "static_site"` and `mode: "url"`, and uses only the returned `url` as the
  iframe source. The static-site host must allow the Command Center origin in its production
  `Content-Security-Policy: frame-ancestors` response, while Command Center must allow the hosted
  site origin in its own `Content-Security-Policy: frame-src` response; either policy can prevent
  framing. After a version-1 `mainsequence.*` `ready` message from the exact iframe
  window and launch origin, Command Center replies on the same channel with an `initialize`
  message containing only the logged-in user's UID plus the active theme ID and light/dark mode.
  Theme changes resend that initialization context. Closing the viewer unmounts the iframe and
  discards the one-use URL. Embedded sites are intentionally iframe-only and the viewer must not
  expose a toolbar or top-level new-tab action; the iframe is full-bleed and Escape closes the
  viewer. Do not add an HTML `sandbox` attribute to the static-site iframe: project-owned Vite
  applications can depend on browser storage during module bootstrap, and the restricted sandbox
  leaves their React root empty. Isolation is instead enforced by the cross-origin boundary, the
  gateway's `frame-ancestors` policy, Command Center's `frame-src` policy, and strict source/origin
  checks on the postMessage handshake.
- The project detail summary card owns the top-right project actions menu.
- That control uses a compact vertical 3-dots trigger and keeps project-agent actions inside a
  nested `Project agent` submenu so more project-scoped actions can be added without growing the
  summary-card chrome.
- When `by-project/<projectUid>/` reports a project-agent service with `agent_uid`, the `Chat with
  project agent` submenu action opens the dedicated project-agent rail using that public agent UID.
  That rail is separate from the normal Command Center `Cmd+J` rail, so both can stay open at the
  same time.
- The same project actions menu also owns `Configure project agent` and `Update SDK`.
- `Update SDK` posts to `/orm/api/pods/projects/<project_uid>/update-sdk/` and should stay grouped
  with other project-scoped maintenance actions instead of being added as a standalone button.
- The full project-agent build/deploy/delete form is implemented by the `Main Sequence AI`
  shared `ProjectAgentConfigurator`, but the workbench project actions menu opens it in a modal
  for the selected project instead of navigating away or asking the user to select a project again.
- Agent release creation now warns that project execution agents are unique per project and that
  republishing the agent with a different image overrides that project-agent functionality.
- That project-agent mode is not the generic `Create Agent Release` flow: it opens with the title
  `Create Project Agent`, uses the selected ready project image, and targets the
  `project_agent_card` resource type. In that mode the modal does not call the shared
  project-resources query, because the dedicated project-agent endpoint does not accept a selected
  resource id.
- The `Create Project Agent` submit path does not call the generic `resource-release/` create
  endpoint. It posts
  `{ project, project_related_image, cpu_request?, memory_request?, gpu_request?, gpu_type?, spot? }`
  to `/orm/api/agents/v1/project-executor-agent-services/get_or_create/`.
- That legacy `get_or_create/` endpoint still exists for compatibility, but the dedicated
  `Project Agent` tab now uses the explicit `build-image/` plus `deploy/` flow instead.
- The project-agent toast path now uses the backend response `detail` when that endpoint returns a
  202-style “not ready yet” payload, and downgrades that case to an informational toast instead of
  always showing the same deterministic success copy.
- Both the generic release modal and the dedicated `Create Project Agent` mode expose the shared GPU
  count/type controls backed by the common available-GPU-types query. Project-agent creation forwards
  that GPU selection through the `project-executor-agent-services/get_or_create/` request instead of
  silently dropping it.
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
- The bulk `Delete Projects with Repositories` action is intentionally double-confirmed. The first confirmation explains the project delete scope, and the second final confirmation requires the repository-specific phrase before the destructive delete request is sent.
- The project images tab polls every 60 seconds only while the current page still contains a building image, and those rows render a spinner instead of a warning pill.
- The project images tab displays backend-provided image `tags` in the list view and includes those tags in the local filter.
- The project registry, project jobs tab, project images tab, job-runs tab, and project data-node
  updates tab now forward their search text to backend paginated endpoints. Those surfaces should
  render `query.data.results` as the already-filtered page instead of filtering only the loaded
  page in the browser.
- Job creation and resource release creation share the same project-image picker formatting, including backend-provided image tags in picker descriptions and search keywords.
- Job creation, resource release creation, and project-agent release creation use the shared Main
  Sequence resource-requirements block so CPU, memory, GPU, and capacity controls stay
  grouped consistently instead of being split across unrelated form sections.
- Those resource-requirements blocks expose the shared `Estimate cost` action, which sends the
  selected CPU, memory, GPU, GPU type, and capacity mode to the billing estimate endpoint and shows
  the total plus CPU/memory/GPU rates.
- The create-project dialog auto-selects the first available data source and default base image once form options load.
- Project creation sends the selected GitHub organization as `github_org_uid`; do not use the older `github_organization` request key.
