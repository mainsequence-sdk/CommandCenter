# Apps and Surfaces

## Overview

Command Center is now organized around apps first, not dashboards first.

The shell flow is:

1. Pick an app from the left rail.
2. Land on that app's default home surface.
3. Navigate surfaces within the app.
4. Use global search to jump across apps, surfaces, and utility actions.

This matches how users typically think about product domains: "Markets", "Execution", or "Admin" come first, and the monitoring or workflow screens inside those domains come second.

## Core model

The runtime uses four layers:

- `Extension`: packaging unit that contributes apps, widgets, and themes.
- `App`: top-level product domain shown in the left rail.
- `Surface`: an app-local screen. Surfaces can be dashboards, pages, or tools.
- `Widget`: reusable building block used inside dashboard surfaces only.

## Surface kinds

### Dashboard

Use dashboards for monitoring and scanning.

- many panels at once
- summary-first
- backed by the dashboard grid layout engine

### Page

Use pages for review, exploration, and structured content.

- narrative or section-based layout
- not constrained to the dashboard grid
- backed by a custom React component

### Tool

Use tools for action-oriented workflows.

- forms, inputs, mutations, and results
- usually centered on one main task
- backed by a custom React component

## Navigation behavior

### Left rail

The shell uses two navigation layers on the left:

- one icon per app
- permission-gated
- clicking an app routes to `/app/:appId`
- that route redirects to the app's default accessible surface
- clicking the active app toggles an on-demand contextual panel
- the contextual panel overlays the content area instead of permanently consuming layout width

### In-app navigation

Once an app is selected, surface switching moves into the topbar.

- the current app name in the topbar opens an app details modal
- the adjacent topbar selector lists accessible surfaces grouped into sections
- the left contextual app panel exposes the selected app's surfaces inside those same sections
- surfaces without an explicit section fall back to kind-based groups such as `Pages` and `Tools`
- surfaces are filtered by both app and surface permissions
- hidden surfaces are excluded from normal navigation flow
- the main content area stays focused on the active surface instead of repeating app metadata

### Global search

The topbar search is global, not app-local.

It returns:

- app homes
- app surfaces
- utility actions such as widget catalog and access explorer

This gives users both discovery paths:

- browse structurally through the left rail, on-demand contextual app panel, and topbar selector
- jump directly through search

### Favorites

The shell supports user-level favorites for both app surfaces and selected workspace instances.

- any view in an app surface menu can be starred
- specific `Workspaces` instances can also be starred from the workspace index
- those favorites are stored at the shell level and reused across the platform
- the topbar exposes a quick favorites menu for fast jumps across apps and saved workspaces
- surface favorites are still filtered by access, and stale workspace favorites are dropped if the workspace no longer exists locally

### User menu

Session-level controls and user-scoped utilities such as theme switching, the widget catalog, theme studio, and the access explorer belong in the user menu and settings surfaces, not in persistent content chrome.

## Extension contract

Extensions now register apps instead of separate top-level dashboard and application lists.

```ts
export interface AppExtension {
  id: string;
  title: string;
  description?: string;
  widgets?: WidgetDefinition[];
  apps?: AppDefinition[];
  themes?: ThemePreset[];
}
```

Each app owns its surfaces:

```ts
export interface AppDefinition {
  id: string;
  title: string;
  description: string;
  source: string;
  icon: AppIcon;
  navigationPlacement?: "primary" | "admin-menu";
  topNavigationStyle?: "selector" | "hidden";
  requiredPermissions?: string[];
  defaultSurfaceId: string;
  surfaces: AppSurfaceDefinition[];
}
```

Use `navigationPlacement: "admin-menu"` for admin-only applications that should stay out of the
primary left rail while still behaving like first-class apps. `Access & RBAC` is the core example
of that pattern.

Use `topNavigationStyle: "hidden"` when an app manages its own surface navigation inside the page
itself and should not expose a surface switcher in the global topbar. `Access & RBAC` now uses
that pattern.

And each surface declares its UX intent:

```ts
type AppSurfaceDefinition =
  | { kind: "dashboard"; dashboard: DashboardDefinition; ... }
  | { kind: "page"; component: ComponentType; ... }
  | { kind: "tool"; component: ComponentType; ... };
```

Surfaces can also declare an optional navigation section when the app needs grouped in-app menus:

```ts
const workspaceSection = {
  id: "workspace",
  label: "Workspace",
  order: 10,
};

const mainSequenceApp: AppDefinition = {
  ...,
  surfaces: [
    {
      id: "projects",
      title: "Projects",
      kind: "page",
      navigationSection: workspaceSection,
      component: ProjectsPage,
    },
    {
      id: "constants",
      title: "Constants",
      kind: "page",
      navigationSection: workspaceSection,
      component: ConstantsPage,
    },
  ],
};
```

This keeps the grouping logic in the platform contract instead of baking one-off section headers
into individual app navigation components.

## Routing

The primary route model is:

- `/app/:appId`
- `/app/:appId/:surfaceId`

Legacy dashboard and workspace URLs are still redirected for compatibility, but they are no longer the primary mental model.

## Why this model scales better

This structure avoids two common failures:

- a flat list of unrelated dashboards and applications in the main navigation
- forcing every workflow into the dashboard grid

With the app-and-surfaces model:

- the left rail stays stable as product scope grows
- dashboard layout stays specialized for monitoring
- custom pages and tools can grow without fighting the grid system
- extension authors contribute product domains, not just isolated tiles
