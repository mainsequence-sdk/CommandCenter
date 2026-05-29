# Workspaces Feature

This folder owns the `Workspaces` app experience shipped by the core extension.

It currently covers six user flows:

- the workspace index table
- the workspace canvas editor
- the workspace graph editor
- the widget-instance settings page
- the workspace settings page
- the saved-widget library

These flows are all part of one app surface, with instance state selected through query params.

## Entry Points

- `WorkspacesPage.tsx`: landing page for the `Workspaces` app. Lists all locally stored workspaces and routes into a selected workspace instance. It also routes `?mode=public-preview` into the shellless authenticated preview projection.
- `SlideStudioPage.tsx`: curated `workspace-studio` surface that reuses the shared workspace list/canvas host, filters to `type=slide-studio`, re-enables the `Slide` widget in that surface only, and routes into the Slide Studio-only slideshow and print projection modes.
- `PublicWorkspacePreviewPage.tsx`: shellless authenticated projection for `workspace` and `slide-studio` workspaces. It reuses the normal runtime canvas without authoring chrome so signed users can preview the eventual public rendering contract.
- `public-workspace-permissions.ts`: shared synthetic public render permission profile used by both authenticated public preview and anonymous public view. It intentionally grants only the baseline public workspace visibility contract.
- `DashboardWidgetExecution.tsx`: shared widget execution provider. It now also exposes an explicit
  `public-workspace` execution surface and widget-instance lookup so public routes can switch
  source widgets onto backend-owned public execution URLs without forking the widget graph.
- `SlideStudioSlideshowPage.tsx`: Slide Studio-only projection surface. It reuses the same workspace document and slide/widget rendering contracts but presents one top-level slide per screen with slideshow navigation.
- The slideshow projection now uses tighter stage padding on small viewports and asks the shared
  slide surface to maximize the fitted frame on mobile before adding desktop-style breathing room.
- `SlideStudioPrintPage.tsx`: Slide Studio-only print projection. It renders the whole deck in one
  pass, keeps hidden dependency widgets hydrated offscreen, maps one top-level slide to one print
  page, and triggers the normal browser print flow so users can save the deck as PDF.
- `slide-studio-runtime.tsx`: shared deck/runtime adapter for slideshow and print projections. It
  centralizes top-level slide collection, slide-contained widget mapping, offscreen dependency
  hydration, and projection-safe widget card rendering.
- `WorkspaceStudioCanvasHost.tsx`: reusable selected-workspace host that mounts the shared workspace canvas/settings/graph provider stack for any surface that wants to reuse the studio. It also supports the shellless `publicPreview` projection over the same runtime document.
- `WorkspaceCanvasWidgetHost.tsx`: shared widget renderer used by both the root canvas host and the slide subgrid host so widget chrome, headers, actions, inline edit gating, and body rendering stay identical across both layout hosts.
- `WorkspaceSlideSubgridHost.tsx`: slide-only body-stage layout host. It keeps slide-contained widgets on a separate subgrid from the root canvas while shrinking slide row height to fit the active body bounds instead of letting slide widgets overflow.
- `WorkspaceRenderErrorBoundary.tsx`: workspace-level recovery surface used when malformed or unsupported workspace data breaks canvas or graph rendering. It keeps a readable error UI in front of the user and preserves a route back into workspace settings for JSON export/import recovery.
- `CustomDashboardStudioPage.tsx`: full-bleed workspace canvas editor with widget drag, resize,
  controls, and save flow. It also owns workspace-local runtime-state write batching and the
  variable-refresh coordinator that turns source widget runtime changes, such as table row
  selection, into reference-variable commits through the active dashboard execution provider.
- `CustomWorkspaceGraphPage.tsx`: route-level React Flow editor for workspace widget bindings.
- `CustomWidgetSettingsPage.tsx`: full-width widget-instance settings view for a selected
  workspace widget. It must resolve settings dependencies from the current draft widget props and
  bindings in both route and embedded overlay modes so reference-backed fields do not rehydrate
  from stale saved graph edges while the user is editing.
- `CustomWorkspaceSettingsPage.tsx`: model editor for workspace metadata such as title,
  description, labels, backend-only sharing permissions, and a dedicated publishing tab for
  authenticated public preview plus public-link lifecycle controls. Public-link lifecycle actions
  are gated by the explicit `workspaces:publish` shell permission rather than workspace record
  `requiredPermissions`.
- `public-workspace-readiness.ts`: frontend preflight for public publication readiness. It checks workspace type, widget permissions, and unknown widget ids before the settings page allows public-link enablement. Widget-scoped public execution contracts are compiled public-spec metadata, so final execution-contract validation remains backend-authoritative.
- `SavedWidgetsPage.tsx`: dedicated saved-widget and saved-widget-group library screen with metadata editing, deletion, JSON inspection, and permissions.
- `SavedWidgetSaveDialog.tsx`: canvas action flow for saving the selected live workspace widget as a reusable saved widget or saved widget group.
- `SavedWidgetLibraryDialog.tsx`: in-canvas library picker used to import saved widgets and groups back into the current workspace.
- `WorkspaceChrome.tsx`: shared workspace toolbar-button and widget-rail chrome reused across canvas and graph views.
- `WorkspaceComponentBrowser.tsx`: shared workspace component catalog drawer used for searching, favoriting, and adding widgets on the root canvas and inside structural slide regions.
- `WorkspaceGraphNode.tsx`: custom React Flow node renderer that exposes named widget input and
  output ports and surfaces shared execution/runtime status directly on graph cards. Ready nodes
  use success styling, waiting nodes use warning styling, and only execution/runtime failures use
  error styling.
- `WorkspaceRequestDebugPanel.tsx`: workspace request trace sidebar. It groups requests by refresh cycle, exposes duplicate endpoint summaries, and lets each request card expand into execution metadata plus connection-query details such as the effective requested time range.
- `WorkspaceVariableExplorerPanel.tsx` and `workspace-variable-explorer-model.ts`: passive workspace variable inspector. It reads the existing dependency model and variable registry, separates materialized variables from referenced/waiting variables, and never mutates runtime state, widget bindings, or persisted workspace content.
- `useCustomWorkspaceStudio.ts`: route-aware hook that resolves the requested workspace instance and exposes shared actions.
- `custom-workspace-studio-store.ts`: shared draft/saved workspace state used across the list, canvas, and settings views.
- `custom-dashboard-storage.ts`: local-storage persistence, workspace creation helpers, grid migration logic, and widget mutation helpers.
- `workspace-api.ts`: authenticated backend client for optional workspace list/detail persistence.
- `saved-widgets-api.ts`: authenticated backend client for saved widget instance/group list, detail, create, update, and delete flows. List parsing must stay strict to saved-widget list payloads; do not treat arbitrary workspace `widgets` arrays as saved-library results.
- `saved-widgets.ts`: pure snapshot/import helpers that keep saved widgets as a library/import layer instead of changing live workspace runtime persistence.
- `workspace-list-summary.ts`: shared lightweight list-row contract used by the workspace index and backend list endpoint adapter.
- `workspace-persistence.ts`: runtime switch that picks backend persistence when configured and local browser storage otherwise.
- `workspace-favorites.ts`: helper functions for workspace-instance favorites and canonical workspace paths.
- `widget-catalog-preferences.ts`: per-user local storage for workspace canvas component-browser favorites and recent widgets.
- `workspace-studio-surface-config.tsx`: optional route/config layer for reusing the workspace studio from non-core surfaces while filtering widget catalogs, route targets, and surface-specific toolbar actions.
- `slide-studio-workspaces.ts`: core curated-surface helpers for `Slide Studio`, including type filtering, route helpers, and slide-first workspace creation.
- `snapshot/`: client-side live workspace snapshot archive pipeline used by `?snapshot=true`.

## Current Model

- The app is registered in `src/extensions/core/index.ts` as two full-bleed page surfaces:
  `workspaces` and `widgets`.
- The shared workspace studio is no longer hard-wired to the core `workspace-studio` app only.
  Other surfaces can now reuse the same canvas/runtime through `WorkspaceStudioCanvasHost` plus
  `workspace-studio-surface-config.tsx` instead of forking a second canvas implementation.
- The workspace list lives at `/app/workspace-studio/workspaces`.
- The slide-studio list lives at `/app/workspace-studio/slide-studio`.
- Slide Studio also exposes a route-driven slideshow projection on the same surface through
  `?workspace=<id>&mode=slideshow`.
- Slide Studio also exposes a route-driven print projection through
  `?workspace=<id>&mode=print`. Print mode is deck-level, read-only, and intended for the normal
  browser print/save-as-PDF flow rather than a separate PDF generator.
- Authenticated public preview is available for supported workspace types through
  `?workspace=<id>&mode=public-preview`.
- Authenticated public preview uses the same synthetic public render permissions as anonymous
  public view. Route access stays authenticated, but widget rendering no longer inherits the
  signed-in user's broader permission set.
- For `slide-studio`, both authenticated public preview and anonymous public routes default to the
  slideshow projection instead of the generic dashboard canvas.
- Public `slide-studio` slideshow also reuses the shared public workspace status bar so the
  presentation surface keeps the Main Sequence branded top navigation shell.
- On public slideshow viewports below `xl`, the branded bar switches to a compact treatment and
  the slide stage removes outer padding so the fixed-aspect slide can expand to the maximum
  remaining screen area before desktop spacing returns.
- On touch and small-screen slideshow viewports, the slide navigation strip stays persistently
  visible instead of relying on hover, with slide count moved into the public top bar and
  next/previous controls attached to the left and right slide edges so they do not cover content.
- Slideshow mode now also forces a short initial navigation reveal so users see the slide count and,
  on keyboard-friendly viewports, the available `←` / `→` / `Space` / `Shift` + `Space` / `Esc`
  shortcuts before the controls fall back to their normal visibility behavior. That hint now lives
  in slideshow chrome above the stage instead of overlaying the slide canvas itself.
- Workspace settings now manage backend-owned public links through the canonical publish lifecycle:
  `GET /public-link/`, `POST /public-link/publish/`, `POST /public-link/unpublish/`, and
  `POST /public-link/rotate/`. The frontend treats `publicUrl` / `public_url` as backend-owned
  metadata and does not send it back in normal workspace save payloads.
- `GET /public-link/` now also drives editor-side public status through backend-authored fields:
  `publicWorkspaceSpecHash`, `compiledAt`, `compiledFromWorkspaceUpdatedAt`, and
  `hasUnpublishedChanges`. Workspace settings no longer infer publish drift from list timestamps.
- Anonymous public workspace payloads may now also carry widget-scoped `publicExecution`
  metadata. Public runtime surfaces preserve that metadata on widget instances, do not persist it
  back through normal workspace save/update payloads, and use it as the authoritative execution
  contract for connection-backed source widgets in public mode.
- Anonymous public `workspace` rendering now executes `connection-query` and
  `connection-stream-query` widgets through widget-owned public URLs rather than the private
  connections registry/query endpoints. Slide-studio public slideshow uses the same public
  execution surface and re-enables automatic hydration so source widgets can load in anonymous
  presentation mode.
- Public HTTP widget execution now follows the backend public contract exactly: it posts to
  `widget.publicExecution.queryUrl` with top-level `capability`, plus only the allowed
  `timeRange` and `variables` inputs. It does not send `connectionId`, nested private request
  objects, or derive execution from `props.connectionRef`.
- Public WebSocket widget execution now follows the backend public contract exactly: it connects to
  `widget.publicExecution.streamUrl` and sends `subscribe` messages that include
  `subscriptionId`, `widgetInstanceId`, `capability`, and a nested `request` containing only the
  allowed `timeRange` and `variables` inputs.
- Hidden/sidebar runtime mounting now keeps `connection-stream-query` scoped to its own lifecycle:
  direct stream sources receive dependency-model `resolvedInputs`, managed stream sources receive
  runtime-only embedded props projected from their owner, and all other hidden widgets keep the
  existing raw-props mount path. This lets variable-backed streams resubscribe without moving them
  into graph execution or changing table selection ownership.
- Before enabling a public link, workspace settings now show a local public-readiness control plane.
  It is intentionally a frontend preflight, not the final authority; backend publication validation
  must still make the authoritative allow/block decision.
- The shareable URL shown in workspace settings is a frontend route
  `/public/workspaces/:token` built from the backend public token, not the raw backend API URL.
  That frontend route resolves the workspace from the anonymous backend endpoint and renders it
  shelllessly through the normal read-only dashboard canvas.
- Anonymous public workspace responses must include the canonical workspace `type`. Public routes
  reject any type outside `workspace` and `slide-studio`, including `agent-monitor`.
- The anonymous public route also distinguishes explicit loading, not-found, forbidden, unsupported
  type, and render-error states instead of collapsing all failures into one generic error card.
- Anonymous public workspace boot now stores the backend-provided `publicWorkspaceSpecHash`
  alongside the compiled public workspace payload so later drift-handling work can compare and
  replace the active public spec deterministically.
- Private view, public preview, and anonymous public view all keep a non-interactive left widget
  rail so runtime status and error dots stay visible without exposing clickable settings controls.
- The saved-widget library lives at `/app/workspace-studio/widgets`.
- Surface-specific studio reusers may override those route targets and filter visible widget
  definitions while still using the same underlying workspace document model.
- The base `Workspaces` surface now denies `workspace-slide` from its widget catalog/browser by
  default, while the curated `Slide Studio` surface clears that denylist and filters its workspace
  list to `type=slide-studio`.
- Surface-specific studio reusers may also inject toolbar actions through
  `workspace-studio-surface-config.tsx` so extension-owned flows can add workspace-specific launch
  affordances without forking the shared canvas page.
- `Slide Studio` now uses that toolbar-action hook for `Add slide`, `Present`, and `Export PDF`.
  The slideshow projection is route-driven and read-only; it shows one top-level `workspace-slide`
  widget per screen while keeping the same underlying workspace document. The authenticated
  authoring slideshow intentionally reuses the current workspace runtime state and disables
  automatic dashboard hydration so entering presentation mode does not trigger a fresh
  recalculation cycle. Anonymous public slideshow uses the same structural runtime but re-enables
  automatic hydration so public source widgets can execute through the public execution contract.
  Print mode reuses that same projection runtime, but renders the full deck at once, strips
  presentation/editor chrome, keeps hidden dependencies mounted, and waits for a stable pass before
  invoking `window.print()`.
- The app is only included when `VITE_INCLUDE_WORKSPACES=true`. When the flag is `false`, the runtime registry removes `workspace-studio` from navigation and route resolution.
- Opening a workspace instance adds `?workspace=<id>`.
- Opening the workspace graph adds `?workspace=<id>&view=graph`.
- Opening workspace settings adds `?workspace=<id>&view=settings`.
- Opening widget-instance settings adds `?workspace=<id>&view=widget-settings&widget=<instanceId>`.
- Opening the direct bindings inspector adds `?workspace=<id>&view=widget-settings&widget=<instanceId>&tab=bindings`.
- Widget-instance settings include a direct `Widget type details` link to the canonical catalog
  detail route for the underlying widget definition.
- Widget-instance settings commits that modify an executable source, including managed embedded
  connection sources, immediately run that source through the shared widget flow executor so saved
  source props materialize as runtime output and downstream consumers refresh from the graph
  contract.
- Widget-instance settings now keep reference-backed title and schema-setting authoring inside the
  existing settings controls through a compact inline link affordance. The dedicated `Bindings`
  tab remains for true widget IO ports such as datasets and live updates. Synthetic setting/title
  targets are intentionally hidden there.
- Persistence is browser-local and user-scoped through `localStorage` by default.
- If `workspaces.list_url` and `workspaces.detail_url` are configured in `config/command-center.yaml`, the studio switches to backend persistence instead of browser-local storage.
- Saved widget instances and groups require the four `saved_widgets.*` endpoints in `config/command-center.yaml`.
- Saved widget and saved widget group labels now follow the same unified mutation pattern as other
  labelable entities: create/update payloads no longer send labels inline, and the frontend syncs
  labels through the saved-widget detail `add-label/` and `remove-label/` actions derived from the
  configured detail URLs.
- Backend widget-type publication is no longer tied to normal user sign-in. A platform admin must
  explicitly publish the current frontend widget catalog to `widget_types.sync_url` from the
  platform `Admin Settings` modal before backend workspace validation can rely on new widget ids.
- `VITE_USE_MOCK_DATA=true` now boots the workspaces feature from the checked-in
  `mock_data/workspaces/demo_workspace.json` seed, even when backend workspace URLs are configured.
  This keeps the mock workspace demo deterministic on reload instead of reusing whatever was last in
  browser-local storage.
- Older mock-mode workspaces that were saved through the previous mock backend storage key are migrated into the normal browser-local workspace store the first time mock mode loads an otherwise empty local collection.
- Blank, `null`, or `None` workspace URLs keep the browser-local fallback active for local development.
- Backend workspace ids may be numeric; the frontend normalizes them to strings before storing them in the dashboard model and route params.
- Dashboard definitions now support a backward-compatible `layoutKind`, with existing workspaces
  defaulting to `custom`.
- `Custom` currently uses one canonical dense manual grid: `48` columns, `15px` row units, and
  `8px` visual gutters. Older `12`-, `24`-, and `96`-column custom layouts are normalized into
  that model on load so the editor no longer inherits legacy resize steps.
- Custom-layout canvases also keep a non-persisted trailing bottom buffer at runtime so users can
  scroll, drag, and extend the workspace below the last widget without first moving an existing
  card to manufacture empty space. Edit mode intentionally gets a larger buffer than normal view.
- Workspace settings now expose a `Custom` vs `Auto grid` layout selector. `Auto grid` currently
  supports `maxColumns`, `minColumnWidthPx`, `rowHeight`, and `fillScreen`.
- In backend mode, workspace creation waits for the backend response and adopts the backend-assigned id instead of persisting a client-generated id.
- In backend mode, the workspace index now renders from lightweight backend list summaries instead
  of full workspace documents. Full workspace detail is fetched only when a workspace is opened,
  copied, or otherwise needs the actual document body.
- Backend workspace list summary requests now always append `?fe_list=true` to the configured
  `workspaces.list_url`. Only the index/list fetch uses that flag; detail and mutation routes keep
  their existing request shape.
- The workspace index intentionally shows only lightweight user-facing metadata from the backend
  summary rows, such as title, description, labels, and updated time. It should not expose fields
  that are not returned by the summary serializer, persistence mode, user ids, source/origin values,
  raw workspace uids, or internal layout-density details that users do not directly manage from the
  list.
- Collection-level transport metadata such as the draft wrapper `savedAt` is internal store state.
  It must not be presented as workspace metadata in the workspace index or workspace settings UI.
- In backend mode, the editor keeps a local draft and only persists changes when the user explicitly saves.
- Normal `Save workspace` is resource-scoped. When a specific workspace is open, save sends only
  that workspace to the backend detail endpoint (`PUT /workspaces/:uid/`) instead of diffing the
  entire workspace collection first.
- Widget settings saves are workspace-resource saves, not draft-only commits. The settings page
  applies the active form draft to the latest workspace draft and persists that same snapshot
  through the normal workspace save path before showing success. The page-level `Save workspace`
  action on the settings surface uses the same settings-aware path so it cannot persist an older
  widget copy while local form edits are visible.
- Background widget runtime publication should not count as an authored unsaved change. Runtime
  state still updates the mounted workspace draft so tiles and downstream bindings stay live, but
  the save indicator is reserved for explicit workspace edits and persisted user-state changes.
- Runtime-state writes that change active reference-variable sources must also queue and drain a
  variable refresh in the same mounted workspace host. `WorkspaceStudioCanvasHost` supplies the
  dashboard runtime providers and renders `CustomDashboardStudioPage` with
  `withRuntimeProviders={false}`, so the page must still mount
  `WorkspaceRuntimeVariableRefreshCoordinator` in that branch. Otherwise table-driven reference
  variables update the source runtime state but never re-execute affected connection-query widgets
  or downstream consumers. Runtime variable refresh queue entries are revisioned per source widget:
  newer runtime publications replace older pending work without reusing the old queue id, so an
  active refresh completion cannot clear a newer selection or stream-retained value update.
- The workspace index should not scan every stored workspace draft to decide whether the current
  surface is dirty. Unsaved-state indicators are scoped to the currently selected workspace only.
- Workspace normalization is now split by boundary. Load/import paths still run the full migration
  pass for legacy payloads, while normal edit/save paths use the cheaper shared sanitize path so
  new widgets and extensions inherit canonical draft handling automatically without adding their own
  persistence hooks.
- If workspace layout resolution or the shared canvas/graph provider stack throws, the route should
  degrade to the shared workspace recovery surface instead of crashing the whole shell. That
  recovery surface must keep `Open workspace settings` available so corrupted documents can still be
  exported or repaired from JSON.
- In backend mode, delete reloads the workspace collection from the backend after success instead of computing the next list locally.
- Backend delete also marks the just-deleted workspace id as missing until the route query clears, so the detail loader must not immediately refetch the deleted workspace while settings is navigating back to the list.
- In backend mode, workspace save keeps the submitted companion-card layout if the mutation response does not explicitly echo `companions`. It also keeps the submitted widget geometry for matching widget ids so resized cards do not snap back locally after save when the backend response omits or returns stale layout data.
- Workspace edit mode no longer has to treat every widget body as non-interactive. Widgets that opt
  into shared inline canvas editing can remain interactive on the canvas and write directly into
  the current workspace draft, while normal widgets still stay non-interactive during layout/edit
  operations.
- Favorites can target both app surfaces and individual workspace instances.
- Workspace labels are edited in settings as enter-to-add pills instead of a comma-separated text field.
- Workspace settings also expose versioned JSON export/import for full workspace snapshots.
- For `slide-studio` workspaces, settings and toolbar actions also expose `Export PDF`, which opens
  the print projection in a new tab and uses the browser print dialog for PDF export.
- That JSON workspace snapshot/export flow is document-oriented and intentionally separate from the
  live agent snapshot archive described in
  `docs/adr/command_center/adr-live-workspace-agent-snapshot-archive.md`. Do not merge the import/export serializer
  with the live runtime archive flow.
- The live agent archive now runs through a dedicated snapshot runtime mode on the workspace route:
  `?workspace=<id>&snapshot=true`.
- Snapshot mode forces the selected workspace into normal dashboard view, keeps the existing JSON
  export path separate, and mounts `snapshot/WorkspaceSnapshotCapture.tsx` inside the shared
  runtime providers so the archive is assembled from the real mounted client state.
- Snapshot mode expands collapsed workspace rows in the mounted runtime by default so row-owned
  widgets are visible to automation. This expansion is not persisted and does not mark the
  workspace dirty.
- Snapshot capture does not force a manual dashboard refresh. It observes the shared dashboard
  execution state, waits for the normal initial refresh or any active refresh/execution cycle to
  settle, then captures the mounted runtime state.
- The normal workspace edit toolbar now also exposes `Create snapshot`, which runs the same client-
  side archive pipeline in-place and downloads the generated zip directly from the current mounted
  workspace.
- The client-side snapshot contract reuses the shared `command-center.jwt-auth` browser storage
  session shape and returns the generated zip directly from the page runtime through
  `window.__COMMAND_CENTER_SNAPSHOT__` plus the `command-center:snapshot-ready` event instead of
  uploading archives to the backend by default. Normal users keep using canonical JWT+refresh
  auth; machine-run browser automation may inject `authMode: "runtime_credential"` with
  `MAINSEQUENCE_ACCESS_TOKEN`, which sends the same bearer header but disables refresh and
  interactive logout behavior.
- The current archive contents include:
  - `widgets/<instanceId>/snapshot.json` for every widget, including generic fallback snapshots for
    widget families without a custom builder
- The live archive is JSON-only; it does not generate screenshots, PNG graph exports, hidden-widget
  report images, or CSV/text exports.
- Passthrough infrastructure widgets such as connection sources and transformers should emit
  metadata-only snapshots and must not dump transported datasets as agent-facing payloads.
- Snapshot mode now exposes one agent-oriented contract only; there are no `evidence` vs
  `full-data` archive variants.
- Widget runtime state can persist in the workspace model when a widget reports it through the shared widget contract.
- Widget instances can now also persist canonical `bindings` separately from props. Binding changes
  clear widget `runtimeState` by default because the upstream data shape has changed.
- Normal workspace widgets may now also persist `slidePlacement` when they belong to a structural
  `workspace-slide` region. This is a persisted workspace contract change and any backend or saved-
  widget payloads that serialize workspace widgets must tolerate and preserve that metadata.
- Workspace documents now also persist a first-class `type` field with the current supported
  values `workspace`, `agent-monitor`, and `slide-studio`. The default Workspaces surface filters
  its list and direct-open behavior to `type=workspace`, while curated surfaces such as Agent
  Monitor use the same field to scope their own workspace lists. In backend mode, workspace list
  requests should now be treated as authoritative and accept `type=<value>` or
  `types=<comma-separated-values>` on the `?fe_list=true` endpoint. Backend list/detail serializers
  should preserve this field instead of relying only on labels.
- Slide-contained widgets intentionally use a separate bounded subgrid host from the root canvas,
  but they reuse the same shared widget renderer. The subgrid now belongs only to the slide `body`
  stage; `header` and `footer` are slide-owned bands and `left`/`right` are no longer generic
  widget regions. The body subgrid keeps a fixed logical row height and the slide surface now
  scales one logical 16:9 canvas across editor and slideshow surfaces, so slide composition
  remains visually stable while widgets transferred into or out of a slide are normalized on host
  transfer.
- In canvas edit mode, widget instances expose shared chrome actions through one compact overflow
  menu instead of separate header buttons. Duplicated widgets receive a fresh instance id, keep
  their props/presentation, and drop runtime state so they republish from their own mounted lifecycle.
- The same overflow menu now also exposes a direct `Bindings` entry for widgets that declare
  inputs, including normal non-edit viewing, so canvas users can jump straight into the upstream
  source explorer without first opening the generic settings tab.
- In canvas edit mode, widget cards keep the same header height as view mode; drag uses the existing header band and edit actions fade in without adding extra layout chrome.
- Workspace widget cards are square-edged workspace surfaces. Do not add rounded card corners or
  curved drag-handle corners to the canvas widget shell.
- Non-row widgets in `custom` can now resize all the way down to a single grid column and a single
  grid row. Row widgets keep their fixed full-width, fixed-height behavior.
- Newly added non-row widgets now spawn from one shared workspace starter footprint instead of
  deriving insert size from each widget definition. Existing saved layouts keep their persisted
  geometry, but fresh widget instances now all start at the same baseline so empty widgets do not
  appear collapsed just because their reusable definition has a smaller preferred size elsewhere.
- Widget instances can hide their header in normal viewing, but the workspace canvas forces headers back on during edit mode so drag and settings controls remain available.
- The shared workspace widget host now treats `showHeader` literally in both edit and view mode.
  Edit mode no longer forces a hidden header back on.
- Public preview is a shellless signed-user projection for `workspace` and `slide-studio`. It
  hides workspace toolbars, widget menus, edit rails, and Command Center shell chrome while
  reusing the same runtime canvas and widget renderer as normal view mode. It keeps only a minimal
  read-only refresh/status bar, the shared refresh-progress animation, a brand link, and the theme
  menu.
- The shared widget overflow menu now lives in a static top-right overlay instead of the header
  flow, so edit/view mode no longer change widget proportions just to expose actions.
- Widgets now keep a minimal non-layout drag handle pinned flush to the top-left canvas corner in
  edit mode so the affordance does not consume meaningful internal content area.
- The workspace studio canvas now keeps one canonical `react-grid-layout` layout in both view and
  edit mode. Entering edit mode should not reshuffle cards; the only intended differences are edit
  chrome plus drag/resize interactivity.
- Workspace edit mode is now pure client-side per-workspace UI state in the shared studio store.
  It must survive route changes into widget settings and back to the canvas for the same workspace,
  but it must not become part of the persisted workspace document.
- The studio now uses the root `react-grid-layout` v2 API directly. `CustomDashboardStudioPage`
  passes grouped `gridConfig`, `dragConfig`, `resizeConfig`, and `compactor` props instead of the
  old flat v1 prop surface.
- In `custom` edit mode, resize uses a single bottom-right `se` handle on purpose. This is the
  current desired UX and should not be expanded back into separate edge-only resize handles unless
  the workspace interaction model is intentionally changed.
- For `custom` workspaces, smaller screens now follow a responsive runtime mobile rewrite below
  `769px`: cards temporarily stack full width while preserving their stored row spans, and that
  temporary mobile layout is never persisted back into the workspace model.
- The workspace canvas route now also counts as kiosk-eligible shell content. When a specific
  workspace canvas is open, kiosk mode can hide the global sidebar and topbar there without
  affecting the workspace list or settings routes.
- The workspace canvas also keeps its full-bleed parent layout while kiosk is active. This is
  required because the canvas host expects a full-height, zero-padding container; dropping it into
  the generic padded page shell would collapse the workspace rendering.
- When a workspace switches to `auto-grid`, the studio renders the runtime auto-grid placement and
  keeps manual resize/free placement disabled. `Custom` remains the only manual authoring mode,
  while Auto grid edit mode now supports order-only drag reordering.
- Widget instances can also switch their surface to a transparent mode through shared presentation settings, which removes the default card fill/shadow for flatter workspace compositions.
- The workspace canvas exposes a thin in-canvas widget rail on the left side in both edit and view
  mode: one plain icon per mounted widget instance plus a small runtime-status dot. Hover summaries
  work in all modes. Edit mode additionally makes rail icons open widget settings; view/public modes
  keep the same status rail visible but non-clickable. Widgets can opt into richer rail hover content through shared
  widget-definition metadata. The rail order should reflect live canvas structure, sorted by widget
  layout position (`y`, then `x`, then stable title/id fallback), not by widget creation time. The
  canvas also treats the rail as viewport chrome: a bottom rail scroller mirrors the canvas scroll
  position and can drive the main canvas scroll, so rail visibility and workspace viewport stay in
  sync.
- Workspace widget presentation now also supports `placementMode`. `canvas` keeps the instance
  visible in the grid, while `sidebar` keeps it mounted only in the persistent rail. This is
  intended for composable source widgets such as `Data Node` instances that should keep publishing
  runtime state without consuming canvas area.
- In the workspace graph, widgets that own hidden managed `connection-query` sources should still
  advertise that ownership on the visible owner node. The graph keeps managed source nodes hidden
  by default, but owner cards must show a managed-connection badge and offer a direct reveal
  action that turns on the existing managed-widget graph view.
- The workspace toolbar keeps `Components` and workspace-settings affordances hidden until edit mode
  is active, so normal viewing does not expose authoring controls.
- The confusing standalone toolbar `+` shortcut to saved widgets has been removed from the canvas.
  Saved widgets are now reached through an explicit action inside the `Components` drawer instead
  of looking like a generic add/import button in the top bar.
- Sidebar-only widgets can still expose selected schema fields on the canvas through the shared companion-field system. The widget remains the single owner of props/runtime, while the canvas cards are only projections of that sidebar-owned instance.
- Sidebar-only widgets must not reserve grid cells in the main canvas layout. They stay mounted for runtime publication, but only visible companion cards are allowed to create actual canvas DOM or consume placement space.
- In the studio canvas, exposed companion fields now render as first-class `react-grid-layout`
  items instead of floating absolute overlays. Their committed layout now persists at the dashboard
  level through `dashboard.companions`, while widget presentation still owns only visibility and
  exposure state.
- Workspace rows now follow a collapsible row model instead of the old divider-band model. A row is a
  full-width header item in the main grid; when expanded, its children are simply the following
  sibling widgets until the next row, and when collapsed those child widgets are serialized into
  the row instance itself.
- Widget definitions can set shared presentation defaults. `Data Node` now uses this to default new and existing instances into sidebar placement unless that instance explicitly saved a different placement.
- The dedicated workspace widget settings view now also includes duplicate and remove actions, so sidebar-only widgets remain copyable and deletable even when they do not render a normal on-canvas card with header chrome.
- Widget settings in Workspaces no longer open in a modal. They now use the dedicated
  `view=widget-settings` route state with a shared full-width settings panel and an explicit
  `Return to dashboard` action.
- In the workspace graph, clicking a node still focuses its dependency path, and the selected node
  now exposes one small inline `Open settings` action so users can jump straight into that
  widget's settings without leaving graph context first.
- Snapshot-capable widgets now auto-show their synthetic `Agent context` output in the workspace
  graph even before any edge exists. That keeps `Agent Terminal` bindings discoverable without
  forcing users to manually reveal the hidden context port first.
- Collapsed graph nodes now keep their edge handles visible so users can still drag connections to
  and from compact cards instead of having to expand the node first just to discover the port hit
  target.
- The graph node `Add output` chooser now opens as a floating panel outside the node card instead
  of a cramped inline form. The chooser keeps its own scrollable output list so browsing hidden
  outputs does not fight the main graph pan/zoom surface.
- Workspace graph node expansion is now page-owned and height-aware. Expanding one card remeasures
  that node and repacks its column so cards below it move down instead of overlapping the expanded
  content.
- Manual graph drag now wins for existing nodes. Once a user repositions a node, graph refresh and
  regrouping should preserve that dragged position and should also preserve the node's selected
  state instead of silently resetting it on the next derived-node pass.
- Graph panning is now modifier-gated in the workspace graph. Plain click/drag is reserved for
  node interaction, while canvas pan requires `Ctrl` or `Command` during drag so node selection
  and node dragging are not stolen by the pane.
- Workspace graph selection is page-owned instead of relying on React Flow's built-in element
  selection. Plain click selects a single node or edge in the graph page state, pane clicks clear
  that selection, and edge deletion is handled explicitly from that page-owned active edge.
- Unbound source widgets are now easier to wire in graph mode. Widgets with exactly one output keep
  that output visible even before any edge exists, and the graph uses a larger connection snap
  radius so bindings such as `WorkspaceReference -> Agent Terminal` do not require perfect
  placement just to start authoring.
- The graph layout now also uses layout-only compatibility ordering for unbound pure source widgets.
  A widget with outputs but no inputs, such as `WorkspaceReference`, is placed ahead of unbound
  widgets whose inputs accept its contract so the first authoring pass does not leave both widgets
  buried in one flat unconnected column.
- Graph handles keep pointer interactivity forced on, but the visible handle size stays compact.
  The graph should remain visually quiet while still allowing first-pass drag-to-connect authoring
  on unbound widgets.
- The workspace graph no longer mirrors React Flow `nodes` and `edges` through extra local state.
  It now derives flow props directly from the dependency model plus minimal page-owned drag and
  selection state. That avoids timer-driven and effect-driven re-sync loops that caused visual
  blink and cursor instability in the graph surface.
- The shared dashboard controls provider now supports a configurable refresh-progress animation
  tick. Graph mode keeps the same real refresh cadence, but samples the animated refresh progress
  line more slowly so React Flow hover/drag interactions are not churned by `120ms` context
  updates.
- The graph can expand a Main Sequence AI `Workspace` widget into a read-only referenced workspace
  subgraph. The expansion lazily loads the referenced workspace detail, builds a separate dependency
  model for that workspace, and renders namespaced `ref::...` nodes and edges inside a framed
  read-only workspace cluster to the left of the source `Workspace` node. Referenced widgets keep
  their internal widget-to-widget edges visible through non-connectable read-only ports, and the
  frame connects back to the source `Workspace` card through synthetic read-only reference handles.
  Multiple expanded referenced workspaces are stacked in a dedicated left-side inspection lane so
  new expansions do not render underneath existing referenced frames.
  Binding creation, edge deletion, keyboard deletion, and graph validation remain scoped to the
  selected workspace's local dependency model. Selecting an expandable `Workspace` node shows an
  explicit `Expand workspace` / `Hide workspace` action above the node.
- The widget settings header now scopes its saved/unsaved badge and save-button enabled state to the
  selected workspace only. It must not reflect unrelated unsaved changes elsewhere in the workspace
  collection.
- Workspace unsaved state is mutation-tracked per workspace in the shared studio store. The
  runtime must not recompute dirty state by serializing the full workspace collection or the full
  selected workspace during render. Workspace-scoped surfaces such as canvas, graph, widget
  settings, and workspace settings should read `selectedWorkspaceDirty`; only the workspace index
  should use the aggregate `dirty` flag when it intentionally wants to show that some workspace
  draft in the current session is unsaved.
- The shared store is now keyed by workspace id instead of pretending all loaded workspaces form
  one draft document. `updateWorkspaceDraft(workspaceId, updater)` is the normal hot path for
  editing one loaded workspace, while `workspaceListItems` stays the lightweight list/index source
  and `selectedWorkspaceId` tracks the current active workspace independently of the detail cache.
- Workspace reset actions are also scoped to the selected workspace. A reset button on one
  workspace surface must not discard draft mutations belonging to other workspaces.
- The dedicated widget settings page now also hosts a `Bindings` tab for widgets that declare
  inputs. Binding UI is page-level on purpose so graph edges stay separate from raw props editing,
  and each input now exposes explicit source-widget and source-output selectors instead of a single
  flattened choice. Bindings remain port-to-port in the graph model, but settings can now attach a
  lightweight nested-field extraction transform to the selected source output before compatibility
  is evaluated for that edge. Inputs with `cardinality: "many"` now also support several bound
  source rows in the shared settings UI instead of only one hidden array entry in persisted JSON.
- Widgets can also extend that route with widget-specific authoring tabs when one input needs a
  richer managed-source workflow than the generic binding picker can provide. Widgets that own a
  hidden `connection-query` source should do it through the shared managed-connection consumer
  adapter/registry layer. The Graph widget is the first implementation: it starts managed
  connection creation from `Bindings`, edits the hidden source from a dedicated `Connection` tab,
  and now persists explicit logical roles behind the scenes for migrated live-capable widgets:
  managed HTTP sources bind `dataset -> seedData`, managed WebSocket sources bind
  `updates -> liveUpdates`, and older retained widgets continue using `sourceData`.
- The dedicated widget settings route now keeps only the shared dashboard provider stack alive.
  It must not hidden-mount the full workspace widget tree again. Runtime-dependent settings should
  resolve through the dependency and execution providers, and executable source or transform
  widgets such as `connection-query` and `tabular-transform` are responsible for headless
  publication through
  `WidgetDefinition.execution`.
- Workspace dataflow is moving to the connection-first shape described in
  [ADR: Connection-First Workspace Dataflow](../../docs/adr/command_center/adr-connection-first-workspace-dataflow.md).
  Source widgets should use stable `ConnectionRef` values and publish canonical tabular frames,
  Tabular Transform widgets should own aggregate/pivot/unpivot/projection work, and table/chart/
  statistic widgets should stay passive consumers of upstream `core.tabular_frame@v1` outputs.
- `dashboard` and `widget-settings` now also share one mounted studio/runtime host. Opening widget
  settings must not unmount and recreate the canvas runtime; the settings surface renders as an
  overlay above the still-mounted studio so returning to the workspace stays immediate.
- The studio host owns an optimistic local widget-settings target. Widget settings buttons set that
  local overlay target synchronously without writing URL params. `view=widget-settings` URLs remain
  accepted for direct entry and reload, but normal in-workspace opens are pure local overlay state.
  Closing settings clears the local overlay immediately before any route cleanup.
- Each widget-settings open receives a fresh overlay generation id. Reopening the same widget and
  same tab must still paint the instant shell first; stale body-hydration state from the previous
  open must never let the heavy settings body mount synchronously on the click path.
- The widget-settings open signal is isolated in a tiny overlay store so connection/source widget
  runtime updates do not force the live dashboard tree to rerender before the overlay appears.
  Dashboard selection updates and full settings body hydration are deferred until after the frosted
  overlay shell has had a paint opportunity.
- Widget runtime-state writes are coalesced before committing into workspace user state. Stream
  source widgets may publish many frames per second, but the dashboard host must not synchronously
  clone and compare the workspace tree for every WebSocket message.
- Graph mode must use the same local runtime-state override layer as the workspace canvas before
  building dependency models, rail status, request debug state, and variable explorer entries. A
  stream widget can publish through the runtime store before persisted workspace state catches up,
  so graph status must read the effective rendered workspace, not only persisted
  `instance.runtimeState`.
- Stream source cards must also throttle their visible runtime-entry subscription. The shared
  connection runtime store can ingest every frame, but visible canvas chrome should update at UI
  cadence so settings clicks are not queued behind WebSocket-status renders.
- Widget settings should also open the shell immediately, then hydrate heavy schema/controller/
  widget-specific sections asynchronously with scoped loading placeholders. Expensive settings
  widgets must not block the full overlay from appearing.
- The embedded settings overlay must use the already-mounted dashboard dependency/runtime providers
  for the default settings tab. Draft dependency models are allowed only for the bindings tab, where
  draft bindings need graph validation.
- Workspace sidebar/rail status indicators should derive from the shared dashboard execution layer
  first and only fall back to widget-specific runtime fields when no execution state exists. They
  must not rely on one widget family writing a custom `runtimeState.status` convention to look
  healthy.
- Opening a workspace should also prefer immediate shell/canvas paint over a full-page loading
  blocker. If the requested workspace document is already available locally, the canvas should
  render at once and individual widgets should show their own loading states while background
  hydration/sync continues.
- Direct backend routes such as `?workspace=<id>` must not gate detail loading behind the
  workspace list endpoint. The client should query the workspace detail directly, and a `404`
  from that detail endpoint is the authoritative signal that the requested workspace does not
  exist.
- In backend mode, the shared workspace document and the current user's runtime/view state are now
  loaded separately. `GET workspaces.detail_url` returns only shared workspace structure, while
  `GET workspaces.user_state_list_url?workspace_uid=<id>` hydrates selected controls and widget
  `runtimeState` locally after the shared canvas structure is available. Workspace user-state
  writes to `workspaces.user_state_list_url` must post `workspace_uid` in the mutation body;
  shared workspace mutations continue to strip current-user controls/runtime state from the main
  workspace payload.
- Current-user control changes such as time range and refresh interval now count as unsaved
  workspace state in the shared studio shell, so the normal workspace save affordance reflects both
  shared document edits and current-user state edits.
- The shared shell must not bootstrap the workspace list on mount. Workspace summaries now load
  only from actual workspace surfaces or explicit workspace-favorites interaction, while direct
  `?workspace=<id>` routes resolve through the detail endpoint first so canvas boot is never
  serialized behind `/workspaces/`.
- A workspace detail fetch may seed one summary row into `workspaceListItems`, but that must never
  be treated as a hydrated workspace index. The Workspaces list route should always fetch the full
  backend list before rendering the index as authoritative.
- Canvas widget submit and widget-settings `Test request` both use the shared dashboard execution
  layer, but they no longer mean the same thing. Canvas-side source actions such as AppComponent
  `Submit` now use source-driven flow execution so downstream executable dependents can rerun
  immediately after the source publishes new runtime state. Settings-side `Test request` remains
  target-scoped and isolated to the selected widget graph.
- Workspace refresh is now execution-scoped only. It must not invalidate the app-wide React Query
  cache or refetch unrelated shell concerns such as notifications.
- Real workspace runtime widgets now follow a single-owner rule. On canvas, graph, rail, and other
  mounted runtime surfaces, a widget must either be an execution-owned runtime source or a pure
  consumer of shared runtime/output. Hidden mounts must not become a second backend request owner,
  and demo/mock widgets are intentionally out of scope for that migration until the real runtime
  widget families are clean.
- The workspace canvas and workspace graph routes now share one runtime/provider stack inside
  `WorkspacesPage.tsx`. Switching between `?workspace=<id>` and `?workspace=<id>&view=graph` must
  not recreate dashboard controls, dependency resolution, or execution state for the same
  workspace id. Returning from graph view to the canvas now uses an explicit shared-provider
  `surface-return` hydration step: visible dashboard widgets mount immediately, passive upstream
  auto-resolution stays suppressed during that return wave, and hidden `sidebarOnlyWidgets` wait
  until the visible dashboard settles.
- The return affordance for `graph -> dashboard` belongs to the dashboard surface, not to graph
  mode. During `surface-return` hydration the dashboard canvas mounts immediately and shows a
  frosted `Loading canvas…` overlay on top of the real canvas so the transition is explicit
  without leaving users on a stale graph-owned waiting state.
- Graph mode still owns one tiny piece of transition feedback: clicking `Return to workspace`
  paints a one-frame `Returning to canvas…` affordance before the route flips, then the dashboard
  surface takes over with its own `Loading canvas…` hydration overlay.
- The workspace graph is now a dedicated route-level React Flow surface built on top of the shared
  dependency layer. It renders one node per widget instance, one edge per canonical binding, keeps
  graph coordinates session-local, stays inside the normal Workspaces shell with the standard app
  navigation visible, reuses the same workspace toolbar-button language and left widget rail as the
  canvas, keeps the `Components` drawer available so widgets can also be added from graph mode,
  adds only a matching return-to-workspace action for graph mode, and writes connection changes back through
  `updateDashboardWidgetBindings(...)` instead of introducing a second graph-storage model. Output-heavy
  widgets now keep graph nodes compact by showing connected outputs first and exposing the rest
  through session-local `Add output` controls rather than rendering every possible port at once.
  Clicking a graph node should also highlight that node's upstream dependency chain, including the
  contributing nodes, the incoming connectors, and the specific input/output ports that participate
  in the highlighted path. Clicking the graph background clears that dependency focus.
  The main graph should stay focused on dependency-relevant widgets: connected nodes remain
  visible, and disconnected widgets are only kept in the main graph if they expose real graph IO.
  Decorative/non-graph widgets such as unconnected Markdown notes should be hidden from the main
  dependency canvas instead of stretching the layout vertically.
  The graph view should also reflect shared dashboard execution: the left rail uses the same
  execution-state source as the canvas, and graph nodes/edges animate during refresh so users can
  see calculation flow through the dependency graph. Request debugging is now a shared workspace
  surface available from both the canvas edit toolbar and graph mode, and it must use the same
  shared refresh-cycle trace so the animation, refresh orchestration, and request log all describe
  one canonical execution path. That request log should include logical cache hits and shared
  in-flight reuse as explicit entries, not silently hide them.
- The graph route must not hidden-mount the full workspace widget tree just to keep runtime alive.
  Graph mode is a dependency/execution surface, not a second component-runtime host. If a widget
  family still needs mounted side effects for graph correctness, that is a bug to fix in the
  widget runtime contract rather than a reason to reintroduce a full hidden mount here.
- Workspace iconography should also stay unified across surfaces. The left rail, graph cards, and
  any other workspace-owned icon affordances must resolve icons from the shared widget-definition
  field `workspaceIcon` through `resolveWorkspaceWidgetIcon(...)` instead of duplicating widget-id
  heuristics in each surface. Instance-aware source widgets such as `connection-query` may extend
  that shared resolver with prop-derived connection-type icons, but the override still belongs in
  the shared resolver rather than per-surface special cases.
- Component browser rows show the same resolved widget icon immediately before the widget name, so
  the add-widget list matches the left widget rail and graph card iconography.
- The dedicated workspace settings page now uses the same scrollable full-page container model as
  the widget settings view, so long workspace configuration pages can be reached fully.
- Saving widget-instance settings updates only that instance's title/props/presentation and must
  not rematerialize the whole dashboard layout. This preserves manually resized widget geometry
  when the user changes settings unrelated to placement.
- In backend mode, workspace settings also expose a `Permissions` tab that reuses the shared
  object-sharing assignment UI against the configured workspace backend endpoint root. Local
  browser-only workspaces keep the tab but explain that RBAC sharing requires backend persistence.
- Saved widgets follow the same RBAC model. The saved-widget library now exposes editable metadata,
  JSON inspection, and a `Permissions` tab backed by the saved-widget endpoint roots rather than a
  workspace-specific ACL model.
- Saving a widget does not convert the live workspace runtime into relational saved-widget rows.
  Saved widgets are a reusable library/import layer. Import always clones the saved widget or group
  back into normal workspace JSON with fresh widget instance ids.
- Saved widget snapshots store the widget definition key as `widgetTypeId` in the frontend layer.
  Backend transports may still serialize that field as `widget_id`, but it refers to widget type,
  not imported canvas instance identity.
- Atomic saved widgets are now strictly self-contained. If a selected widget has widget bindings or
  row-owned child widgets, the save flow requires `Widget group` instead of allowing a lossy atomic save.
- Widget-group save analysis now includes the selected widget structure plus the upstream widgets
  required to satisfy its bindings. It must not expand to unrelated sibling widgets that only share
  a common workspace source.
- Saved widget groups now treat group-level bindings as the canonical source of truth for internal
  member edges. Member widget snapshots inside a group stay atomic and do not own `row.children`.
- The saved-widget transport contract also reflects that split now: group member snapshots are not
  serialized as full saved-widget-instance payloads, and group `binding_payload` stores only
  edge-local metadata such as `source_output_id` and transform fields.
- Canvas widget actions now include `Save widget`, and the workspace toolbar now includes
  `Add saved widget` so reusable widgets can round-trip between the live workspace and the saved
  widget library without leaving the canvas flow.
- The canvas `Components` browser is optimized for large catalogs: dense two-line rows with widget name and description, category/kind/source filters, favorites, recent widgets, and grouped category browse when search is empty. Row metadata must stay in filters/search rather than inline badges or unlabeled row text.
- The rail viewport scroller uses a neutral segmented guide and keeps only the active position
  marker in the theme primary color, so the current viewport stands out without washing the whole
  control in accent color.
- If a workspace still references a widget id that is no longer registered, the canvas explains that the widget is legacy/unavailable and lets the user delete that stale instance directly.
- Workspace deletion from settings uses the shared destructive confirmation dialog. In backend mode, the UI removes the workspace only after the backend confirms the delete.
- The workspace index now also exposes a direct `Copy` action. It clones the selected workspace
  model into a new workspace instance and routes through the normal create flow. In backend mode,
  the list row is summary-only, so `Copy` first hydrates the source workspace detail on demand and
  then creates a brand-new backend workspace row rather than overwriting the source workspace.
- For a shared production backend, keep shared workspace content separate from per-user view state. See `docs/workspace-backend-model.md` and `docs/adr/command_center/adr-shared-workspace-state.md`.

## Important Dependencies

- `@/dashboards/*`: dashboard layout types, grid resolution, and shared dashboard controls.
- `DashboardCanvas.tsx` now preserves canonical `custom` layout semantics for read-only dashboard
  surfaces while also applying the shared temporary small-screen full-width rewrite below `769px`.
  `auto-grid` read-only rendering now uses the rules-based runtime layout adapter instead of
  changing the meaning of `custom`.
- `auto-grid` no longer uses the studio's RGL placement path. `custom` remains the only manual
  authoring mode. Auto grid now renders through CSS Grid `auto-fit` columns in both viewer and
  studio, using only workspace-level Auto grid rules.
- The canvas controls bar now lives inside the scrollable canvas flow as a sticky straight strip
  instead of an absolute floating card, so it stays visually inside the workspace surface and clear
  of the left widget rail.
- `@/dashboards/react-grid-layout-adapter.ts`: adapter utilities for the studio's
  `react-grid-layout` integration. The main workspace canvas now uses it to map widget instances
  into grid items, write committed drag/resize results back into dashboard state, and share the
  drag handle/cancel selectors used by widget chrome.
- `@/widgets/types` and the app registry: widget catalog lookup and widget rendering.
- `@/app/registry/widget-type-sync.ts`: authenticated widget-type catalog sync for backend widget validation.
- `@/stores/shell-store`: cross-shell UI state such as favorites and workspace menu visibility.
- `react-router-dom`: query-param based workspace instance routing.

## Maintenance Notes

- Keep this README in sync when the workspace route model, persistence contract, favorites model, or settings/canvas split changes.
- Update this README when the JSON snapshot schema or widget runtime-state contract changes.
- Keep this README aligned with the actual canvas ownership split. The current studio uses
  `react-grid-layout` for normal canvas widgets, row headers, and exposed companion cards, while
  sidebar-only runtime mounts remain structural concerns outside that main grid.
- Keep this README aligned with companion ownership. Companion-card placement is now dashboard
  state, not widget-presentation geometry, even though exposure/visibility is still controlled from
  widget presentation.
- Keep this README aligned with the layout-mode split: `custom` should remain the canonical saved
  grid contract, while future `auto-grid` behavior should live in a separate mode.
- Keep this README aligned with the current Auto grid policy: `maxColumns` is an upper bound, not
  a fixed reserved slot count. Auto grid width should come from CSS Grid `auto-fit` behavior, while
  `custom` remains canonical RGL.
- Update `docs/workspaces.md` whenever the user-facing Workspaces behavior changes in a meaningful way.
- If this folder splits into smaller feature directories later, add nested `README.md` files near the new ownership boundaries.
