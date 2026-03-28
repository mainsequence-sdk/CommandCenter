# Workspaces Feature

This folder owns the `Workspaces` app experience shipped by the core extension.

It currently covers four user flows:

- the workspace index table
- the workspace canvas editor
- the widget-instance settings page
- the workspace settings page

These flows are all part of one app surface, with instance state selected through query params.

## Entry Points

- `WorkspacesPage.tsx`: landing page for the `Workspaces` app. Lists all locally stored workspaces and routes into a selected workspace instance.
- `CustomDashboardStudioPage.tsx`: full-bleed workspace canvas editor with widget drag, resize, controls, and save flow.
- `CustomWidgetSettingsPage.tsx`: full-width widget-instance settings view for a selected workspace widget.
- `CustomWorkspaceSettingsPage.tsx`: model editor for workspace metadata such as title, description, and labels.
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
- Opening workspace settings adds `?workspace=<id>&view=settings`.
- Opening widget-instance settings adds `?workspace=<id>&view=widget-settings&widget=<instanceId>`.
- Persistence is browser-local and user-scoped through `localStorage` by default.
- If `workspaces.list_url` and `workspaces.detail_url` are configured in `config/command-center.yaml`, the studio switches to backend persistence instead of browser-local storage.
- `VITE_USE_MOCK_DATA=true` forces the workspaces feature back to browser-local persistence even when backend workspace URLs are configured, so the studio can stay self-contained during mock development.
- Older mock-mode workspaces that were saved through the previous mock backend storage key are migrated into the normal browser-local workspace store the first time mock mode loads an otherwise empty local collection.
- Blank, `null`, or `None` workspace URLs keep the browser-local fallback active for local development.
- Backend workspace ids may be numeric; the frontend normalizes them to strings before storing them in the dashboard model and route params.
- In backend mode, workspace creation waits for the backend response and adopts the backend-assigned id instead of persisting a client-generated id.
- The workspace index page renders from the backend-backed saved collection in backend mode, even if the editor currently has unsaved draft changes.
- In backend mode, the editor keeps a local draft and only persists changes when the user explicitly saves.
- In backend mode, delete reloads the workspace collection from the backend after success instead of computing the next list locally.
- Favorites can target both app surfaces and individual workspace instances.
- Workspace labels are edited in settings as enter-to-add pills instead of a comma-separated text field.
- Workspace settings also expose versioned JSON export/import for full workspace snapshots.
- Widget runtime state can persist in the workspace model when a widget reports it through the shared widget contract.
- In canvas edit mode, widget instances expose shared chrome actions through one compact overflow
  menu instead of separate header buttons. Duplicated widgets receive a fresh instance id, keep
  their props/presentation, and drop runtime state so they republish from their own mounted lifecycle.
- In canvas edit mode, widget cards keep the same header height as view mode; drag uses the existing header band and edit actions fade in without adding extra layout chrome.
- Non-row widgets now obey a shared minimum canvas size when they are created, resized, duplicated,
  or normalized from stored workspace data. This prevents cards from collapsing into near-zero
  height or width while still preserving the special fixed-height behavior for row widgets.
- Widget instances can hide their header in normal viewing, but the workspace canvas forces headers back on during edit mode so drag and settings controls remain available.
- Widget instances can also switch their surface to a transparent mode through shared presentation settings, which removes the default card fill/shadow for flatter workspace compositions.
- The workspace canvas also exposes a thin in-canvas widget rail on the left side: one plain icon per mounted widget instance, with direct access to that widget's settings, a small runtime-status dot, and hover summaries. Widgets can opt into richer rail hover content through shared widget-definition metadata.
- Workspace widget presentation now also supports `placementMode`. `canvas` keeps the instance visible in the grid, while `sidebar` keeps it mounted only in the rail. This is intended for composable source widgets such as `Data Node` instances that should keep publishing runtime state without consuming canvas area.
- Sidebar-only widgets can still expose selected schema fields on the canvas through the shared companion-field system. The widget remains the single owner of props/runtime, while the canvas cards are only projections of that sidebar-owned instance.
- Sidebar-only widgets must not reserve grid cells in the main canvas layout. They stay mounted for runtime publication, but only visible companion cards are allowed to create actual canvas DOM or consume placement space.
- Widget definitions can set shared presentation defaults. `Data Node` now uses this to default new and existing instances into sidebar placement unless that instance explicitly saved a different placement.
- The workspace settings dialog now also includes a remove action, so sidebar-only widgets remain deletable even when they do not render a normal on-canvas card with header chrome.
- Widget settings in Workspaces no longer open in a modal. They now use a dedicated route-level view with a shared full-width settings panel and an explicit `Return to dashboard` action.
- The canvas `Components` browser is optimized for large catalogs: dense rows, category/kind/source filters, favorites, recent widgets, and grouped category browse when search is empty.
- If a workspace still references a widget id that is no longer registered, the canvas explains that the widget is legacy/unavailable and lets the user delete that stale instance directly.
- Workspace deletion from settings uses the shared destructive confirmation dialog. In backend mode, the UI removes the workspace only after the backend confirms the delete.
- For a shared production backend, keep shared workspace content separate from per-user view state. See `docs/workspace-backend-model.md` and `docs/adr-shared-workspace-state.md`.

## Important Dependencies

- `@/dashboards/*`: dashboard layout types, grid resolution, and shared dashboard controls.
- `@/widgets/types` and the app registry: widget catalog lookup and widget rendering.
- `@/stores/shell-store`: cross-shell UI state such as favorites and workspace menu visibility.
- `react-router-dom`: query-param based workspace instance routing.

## Maintenance Notes

- Keep this README in sync when the workspace route model, persistence contract, favorites model, or settings/canvas split changes.
- Update this README when the JSON snapshot schema or widget runtime-state contract changes.
- Update `docs/workspaces.md` whenever the user-facing Workspaces behavior changes in a meaningful way.
- If this folder splits into smaller feature directories later, add nested `README.md` files near the new ownership boundaries.
