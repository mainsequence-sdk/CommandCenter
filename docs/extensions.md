# Extensions

## Purpose

Extensions are the primary way to add product surface area to Command Center. Instead of modifying the shell directly, new widgets, apps, surfaces, and themes should be shipped as modules under either:

- `src/extensions/` for bundled platform extensions
- `extensions/` at the repo root for independent product modules that should live outside the shell source tree

## Extension contract

Every extension exports a default object that matches `AppExtension`:

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

## Extension loading

The app registry loads extensions from both locations:

```ts
const internalModules = import.meta.glob("../../extensions/*/index.ts", { eager: true });
const externalModules = import.meta.glob("../../../extensions/*/index.ts", { eager: true });
```

That means each extension should have a single `index.ts` entrypoint.

Repo-root extensions can still import shared runtime APIs, app contracts, widgets, UI primitives, and data adapters through the `@/` alias. This keeps the shell reusable while allowing product modules to live outside `src/`.

Bundled extension-owned pages and tools should also live under their owning extension tree instead
of a generic `src/features/` folder. A core example is:

- `src/extensions/core/index.ts`
- `src/extensions/core/apps/access-rbac/`

## Public gallery

Command Center also exposes a public npm-backed extension discovery route at:

- `/extensions`

The gallery queries npm for packages tagged with:

- `mainsequence-command`

Package authors can enrich the gallery card and detail view by adding a `mainsequence-command`
block to `package.json`.

Example:

```json
{
  "name": "@acme/foo-command",
  "keywords": ["mainsequence-command"],
  "mainsequence-command": {
    "type": "extension",
    "title": "Foo Command",
    "description": "Adds Foo workflow support",
    "image": "https://cdn.example.com/foo.png",
    "video": "https://cdn.example.com/foo.mp4",
    "demo": "https://foo-demo.example.com",
    "categories": ["automation", "research"],
    "author": {
      "name": "Jane Doe",
      "url": "https://github.com/janedoe"
    }
  }
}
```

The route is intentionally read-only. npm remains the package registry; Command Center just
normalizes metadata into a searchable gallery.

## What belongs in core

Core is for platform-level building blocks:

- reusable shell widgets
- default apps and surfaces
- theme presets
- registry-compatible primitives

Core should not own vendor-specific integrations when those integrations are optional or replaceable.

## What belongs in optional extensions

Optional extensions are the right place for:

- charting libraries
- grid libraries
- proprietary widgets
- desk-specific workflows
- third-party service integrations

Current examples:

- `src/extensions/ag-grid/index.ts`
- `src/extensions/lightweight-charts/index.ts`
- `src/extensions/flow-lab/index.ts`
- `extensions/research-suite/index.ts`
- `extensions/main_sequence/extensions/workbench/index.ts`
- `extensions/main_sequence/extensions/markets/index.ts`

## Adding a widget

1. Create the widget component under `src/widgets/...`.
2. Export a `WidgetDefinition`.
3. Register the widget in an extension entrypoint.
4. Keep the `source` field aligned with the extension id.
5. Add permission metadata if the widget should not be universally available.

Example:

```ts
export const orderBookWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "order-book",
  title: "Order Book",
  description: "Level II style side-by-side bid/ask widget shipped by an extension.",
  category: "Execution",
  kind: "custom",
  source: "flow-lab",
  defaultSize: { w: 4, h: 5 },
  requiredPermissions: ["orders:read"],
  exampleProps: { symbol: "TSLA" },
  component: OrderBookWidget,
};
```

## Adding an app

Apps are the primary navigation unit in the left rail.

Use an app when:

- users should think of the feature set as one domain or workflow area
- multiple surfaces belong together under one icon and permission boundary
- the shell should land users on a default home surface

Example:

```ts
const executionApp: AppDefinition = {
  id: "execution",
  title: "Execution",
  description: "Desk-facing execution monitoring and workflow surfaces.",
  source: "flow-lab",
  icon: PanelsTopLeft,
  requiredPermissions: ["orders:read"],
  defaultSurfaceId: "desk",
  surfaces: [],
};
```

Keep app pages and tools next to the extension that owns them.

Bundled example:

- `src/extensions/core/index.ts`
- `src/extensions/core/apps/access-rbac/AccessRbacOverviewPage.tsx`

Repo-root example:

- `extensions/research-suite/index.ts`
- `extensions/research-suite/ResearchBriefingPage.tsx`
- `extensions/research-suite/ScenarioLabTool.tsx`

## Adding a dashboard surface

Dashboards are plain TypeScript objects. A dashboard surface references a `DashboardDefinition`, which in turn references widget ids, declares panel size, and can optionally provide placement hints.

Use a dashboard surface when:

- the primary job is monitoring or scanning
- multiple widgets should be visible at once
- layout should be handled by the dashboard grid engine

Recommended authoring style:

```ts
const deskDashboard: DashboardDefinition = {
  id: "desk",
  title: "Desk",
  description: "Execution monitoring surface.",
  source: "flow-lab",
  widgets: [
    {
      id: "desk-chart",
      widgetId: "price-chart",
      title: "Price",
      props: { symbol: "TSLA" },
      layout: { cols: 8, rows: 5 },
      position: { x: 0 },
    },
    {
      id: "desk-orderbook",
      widgetId: "order-book",
      title: "Book",
      props: { symbol: "TSLA" },
      layout: { cols: 4, rows: 5 },
      position: { x: 8 },
    },
  ],
};

const executionApp: AppDefinition = {
  id: "execution",
  title: "Execution",
  description: "Desk-facing execution monitoring and workflow surfaces.",
  source: "flow-lab",
  icon: PanelsTopLeft,
  defaultSurfaceId: "desk",
  surfaces: [
    {
      id: "desk",
      title: "Desk",
      description: "Execution monitoring surface.",
      kind: "dashboard",
      dashboard: deskDashboard,
    },
  ],
};
```

The runtime auto-packs panels downward to avoid overlap. Legacy `layout: { x, y, w, h }` objects are still supported for compatibility, but new dashboards should prefer `layout: { cols, rows }` plus optional `position`.

## Adding a page or tool surface

Pages and tools are full React surfaces that render inside an app without going through the dashboard grid.

Use them when:

- the workflow needs custom layout or richer interaction than a tile grid
- the view mixes forms, runbooks, lists, and task flows
- the surface should still participate in app navigation and RBAC

Example:

```ts
const executionApp: AppDefinition = {
  id: "execution",
  title: "Execution",
  description: "Desk-facing execution monitoring and workflow surfaces.",
  source: "flow-lab",
  icon: PanelsTopLeft,
  defaultSurfaceId: "execution-console",
  surfaces: [
    {
      id: "execution-console",
      title: "Execution Console",
      description: "Operator-first application surface.",
      kind: "tool",
      requiredPermissions: ["orders:read"],
      component: ExecutionConsoleApp,
    },
  ],
};
```

## State and navigation safety

When an extension adds its own lists, drill-down navigation, or popovers, a few patterns matter if you want the shell to stay stable.

### Namespace extension-owned URL params

Do not use generic query params such as `tab`, `id`, `projectId`, or `page` for extension-local state. The host shell or another extension may already use them.

Prefer extension-scoped names such as:

- `msProjectId`
- `msTab`
- `researchScenarioId`

When updating query params:

- clone the current `URLSearchParams`
- change only the extension-owned keys
- preserve unrelated params already on the URL
- optionally read legacy keys for backward compatibility while writing only the new namespaced keys

### Memoize filtered registry arrays

Registry pages often derive filtered rows before passing them into selection hooks, bulk action toolbars, or pagination helpers.

Avoid inline filtered arrays like this:

```ts
const filteredProjects = (projectsQuery.data?.results ?? []).filter(...);
```

That creates a new array on every render. If a downstream hook trims selection based on visible rows, that can turn into noisy rerenders or render loops.

Prefer:

```ts
const filteredProjects = useMemo(() => {
  const needle = deferredFilterValue.trim().toLowerCase();

  return (projectsQuery.data?.results ?? []).filter((project) => {
    if (!needle) {
      return true;
    }

    return project.project_name.toLowerCase().includes(needle);
  });
}, [deferredFilterValue, projectsQuery.data?.results]);
```

### Do not write equivalent selection state every render

Selection hooks that prune hidden rows must avoid calling `setState` with a fresh-but-equivalent array on every render.

Bad pattern:

```ts
useEffect(() => {
  const visibleIds = new Set(items.map((item) => item.id));
  setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
}, [items]);
```

Safer pattern:

- compute the next selected ids
- compare with the current ids
- return `current` when the contents are unchanged

This prevents list surfaces from thrashing when `items` is recreated often.

### Outside-click handlers must not steal navigation clicks

Popovers, menus, and picker dropdowns should not make the rest of the app feel dead while they are open.

Rules:

- avoid full-page invisible overlays unless the surface is a real modal
- be careful with global `window.pointerdown` listeners, because they can consume the same interaction the user intended for navigation
- for lightweight menus and dropdowns, a `click` outside handler is often safer than `pointerdown`
- if you do need an overlay, make sure the opening click cannot immediately trigger the closing logic

The Main Sequence extension is the reference example for these rules because it combines registry tables, bulk selection, query-param drill-down, dialogs, and app-local popovers in one product module.

## Adding a theme

Themes are also extension-friendly. A theme preset can be shipped by core or by any extension, and the theme studio will load it automatically through the registry.

## Guidelines

- Keep vendor bindings out of `core` whenever they are optional.
- Prefer adding new capability through extension composition rather than editing the shell.
- Keep ids stable once shipped.
- Use `source` metadata consistently so the widget catalog explains where a component came from.
- Treat extensions as product modules, not dumping grounds.
- Prefer app-first organization: group related dashboards, pages, and tools under one app instead of shipping a flat list of unrelated entry points.
- Prefer repo-root `extensions/` when you want to prove that a product module is independent from the shell implementation.
