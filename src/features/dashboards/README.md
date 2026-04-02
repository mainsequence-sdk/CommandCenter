# Workspaces Feature

This folder owns the `Workspaces` app experience shipped by the core extension.

It currently covers five user flows:

- the workspace index table
- the workspace canvas editor
- the workspace graph editor
- the widget-instance settings page
- the workspace settings page

These flows are all part of one app surface, with instance state selected through query params.

## Entry Points

- `WorkspacesPage.tsx`: landing page for the `Workspaces` app. Lists all locally stored workspaces and routes into a selected workspace instance.
- `CustomDashboardStudioPage.tsx`: full-bleed workspace canvas editor with widget drag, resize, controls, and save flow.
- `CustomWorkspaceGraphPage.tsx`: route-level React Flow editor for workspace widget bindings.
- `CustomWidgetSettingsPage.tsx`: full-width widget-instance settings view for a selected workspace widget.
- `CustomWorkspaceSettingsPage.tsx`: model editor for workspace metadata such as title, description, labels, and backend-only sharing permissions.
- `WorkspaceChrome.tsx`: shared workspace toolbar-button and widget-rail chrome reused across canvas and graph views.
- `WorkspaceComponentBrowser.tsx`: workspace component catalog drawer used for searching, favoriting, and adding widgets.
- `WorkspaceGraphNode.tsx`: custom React Flow node renderer that exposes named widget input and output ports.
- `useCustomWorkspaceStudio.ts`: route-aware hook that resolves the requested workspace instance and exposes shared actions.
- `custom-workspace-studio-store.ts`: shared draft/saved workspace state used across the list, canvas, and settings views.
- `custom-dashboard-storage.ts`: local-storage persistence, workspace creation helpers, grid migration logic, and widget mutation helpers.
- `workspace-api.ts`: authenticated backend client for optional workspace list/detail persistence.
- `workspace-persistence.ts`: runtime switch that picks backend persistence when configured and local browser storage otherwise.
- `workspace-favorites.ts`: helper functions for workspace-instance favorites and canonical workspace paths.
- `widget-catalog-preferences.ts`: per-user local storage for workspace canvas component-browser favorites and recent widgets.

## Current Model

- The app is registered in `src/extensions/core/index.ts` as a single full-bleed page surface: `workspaces`.
- The workspace list lives at `/app/workspace-studio/workspaces`.
- The app is only included when `VITE_INCLUDE_WORKSPACES=true`. When the flag is `false`, the runtime registry removes `workspace-studio` from navigation and route resolution.
- Opening a workspace instance adds `?workspace=<id>`.
- Opening the workspace graph adds `?workspace=<id>&view=graph`.
- Opening workspace settings adds `?workspace=<id>&view=settings`.
- Opening widget-instance settings adds `?workspace=<id>&view=widget-settings&widget=<instanceId>`.
- Persistence is browser-local and user-scoped through `localStorage` by default.
- If `workspaces.list_url` and `workspaces.detail_url` are configured in `config/command-center.yaml`, the studio switches to backend persistence instead of browser-local storage.
- When the user authenticates against a live backend, the app also syncs the frontend widget catalog
  to `widget_types.sync_url` once per browser session so backend workspace validation knows the
  available `widgetId` values before the first workspace save.
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
- Workspace settings now expose a `Custom` vs `Auto grid` layout selector. `Auto grid` currently
  supports `maxColumns`, `minColumnWidthPx`, `rowHeight`, and `fillScreen`.
- In backend mode, workspace creation waits for the backend response and adopts the backend-assigned id instead of persisting a client-generated id.
- The workspace index page renders from the backend-backed saved collection in backend mode, even if the editor currently has unsaved draft changes.
- The workspace index intentionally shows user-facing metadata such as title, labels, widget count,
  range, and refresh state, and should not expose internal grid-density details that users do not
  directly manage from the list.
- In backend mode, the editor keeps a local draft and only persists changes when the user explicitly saves.
- In backend mode, delete reloads the workspace collection from the backend after success instead of computing the next list locally.
- In backend mode, workspace save keeps the submitted companion-card layout if the mutation response does not explicitly echo `companions`. It also keeps the submitted widget geometry for matching widget ids so resized cards do not snap back locally after save when the backend response omits or returns stale layout data.
- Favorites can target both app surfaces and individual workspace instances.
- Workspace labels are edited in settings as enter-to-add pills instead of a comma-separated text field.
- Workspace settings also expose versioned JSON export/import for full workspace snapshots.
- Widget runtime state can persist in the workspace model when a widget reports it through the shared widget contract.
- Widget instances can now also persist canonical `bindings` separately from props. Binding changes
  clear widget `runtimeState` by default because the upstream data shape has changed.
- In canvas edit mode, widget instances expose shared chrome actions through one compact overflow
  menu instead of separate header buttons. Duplicated widgets receive a fresh instance id, keep
  their props/presentation, and drop runtime state so they republish from their own mounted lifecycle.
- In canvas edit mode, widget cards keep the same header height as view mode; drag uses the existing header band and edit actions fade in without adding extra layout chrome.
- Non-row widgets in `custom` can now resize all the way down to a single grid column and a single
  grid row. Row widgets keep their fixed full-width, fixed-height behavior.
- Newly added non-row widgets now spawn from one shared workspace starter footprint instead of
  deriving insert size from each widget definition. Existing saved layouts keep their persisted
  geometry, but fresh widget instances now all start at the same baseline so empty widgets do not
  appear collapsed just because their reusable definition has a smaller preferred size elsewhere.
- Widget instances can hide their header in normal viewing, but the workspace canvas forces headers back on during edit mode so drag and settings controls remain available.
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
- For `custom` workspaces, smaller screens now follow a Grafana-style runtime mobile rewrite below
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
- In canvas edit mode, the workspace canvas exposes a thin in-canvas widget rail on the left side:
  one plain icon per mounted widget instance, with direct access to that widget's settings, a
  small runtime-status dot, and hover summaries. Widgets can opt into richer rail hover content
  through shared widget-definition metadata.
- Workspace widget presentation now also supports `placementMode`. `canvas` keeps the instance
  visible in the grid, while `sidebar` keeps it mounted only in the edit-mode rail. This is
  intended for composable source widgets such as `Data Node` instances that should keep publishing
  runtime state without consuming canvas area.
- The workspace toolbar keeps `Components` and workspace-settings affordances hidden until edit mode
  is active, so normal viewing does not expose authoring controls.
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
- The workspace settings dialog now also includes a remove action, so sidebar-only widgets remain deletable even when they do not render a normal on-canvas card with header chrome.
- Widget settings in Workspaces no longer open in a modal. They now use a dedicated route-level view with a shared full-width settings panel and an explicit `Return to dashboard` action.
- The widget settings header now scopes its saved/unsaved badge and save-button enabled state to the
  selected workspace only. It must not reflect unrelated unsaved changes elsewhere in the workspace
  collection.
- The dedicated widget settings page now also hosts a `Bindings` tab for widgets that declare
  inputs. Binding UI is page-level on purpose so graph edges stay separate from raw props editing,
  and each input now exposes explicit source-widget and source-output selectors instead of a single
  flattened choice. Bindings remain port-to-port in the graph model, but settings can now attach a
  lightweight nested-field extraction transform to the selected source output before compatibility
  is evaluated for that edge.
- The workspace graph is now a dedicated route-level React Flow surface built on top of the shared
  dependency layer. It renders one node per widget instance, one edge per canonical binding, keeps
  graph coordinates session-local, stays inside the normal Workspaces shell with the standard app
  navigation visible, reuses the same workspace toolbar-button language and left widget rail as the
  canvas, keeps the `Components` drawer available so widgets can also be added from graph mode,
  adds only a matching return-to-workspace action for graph mode, and writes connection changes back through
  `updateDashboardWidgetBindings(...)` instead of introducing a second graph-storage model.
- The dedicated workspace settings page now uses the same scrollable full-page container model as
  the widget settings view, so long workspace configuration pages can be reached fully.
- Saving widget-instance settings updates only that instance's title/props/presentation and must
  not rematerialize the whole dashboard layout. This preserves manually resized widget geometry
  when the user changes settings unrelated to placement.
- In backend mode, workspace settings also expose a `Permissions` tab that reuses the shared
  object-sharing assignment UI against the configured workspace backend endpoint root. Local
  browser-only workspaces keep the tab but explain that RBAC sharing requires backend persistence.
- The canvas `Components` browser is optimized for large catalogs: dense rows, category/kind/source filters, favorites, recent widgets, and grouped category browse when search is empty.
- If a workspace still references a widget id that is no longer registered, the canvas explains that the widget is legacy/unavailable and lets the user delete that stale instance directly.
- Workspace deletion from settings uses the shared destructive confirmation dialog. In backend mode, the UI removes the workspace only after the backend confirms the delete.
- The workspace index now also exposes a direct `Copy` action. It clones the selected workspace
  model into a new workspace instance and routes through the normal create flow, so backend mode
  creates a brand-new backend workspace row rather than overwriting the source workspace.
- For a shared production backend, keep shared workspace content separate from per-user view state. See `docs/workspace-backend-model.md` and `docs/adr-shared-workspace-state.md`.

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
