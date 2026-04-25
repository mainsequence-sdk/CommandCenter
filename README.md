<table align="center">
  <tr>
    <td align="center" bgcolor="#020409" width="520">
      <br />
      <img
        src="./config/branding/logo_darkmode.png#gh-dark-mode-only"
        alt="Main Sequence Command Center"
        width="420"
      />
      <img
        src="./config/branding/logo_lightmode.png#gh-light-mode-only"
        alt="Main Sequence Command Center"
        width="420"
      />
      <br />
    </td>
  </tr>
</table>

<p align="center">
  <a href="https://github.com/mainsequence-sdk/CommandCenter/actions/workflows/ci.yml">
    <img
      src="https://img.shields.io/github/actions/workflow/status/mainsequence-sdk/CommandCenter/ci.yml?branch=main&style=flat-square&label=CI"
      alt="CI"
    />
  </a>
  <a href="https://mainsequence-sdk.github.io/CommandCenter/">
    <img
      src="https://img.shields.io/badge/docs-Docusaurus-5FB4FF?style=flat-square&logo=docusaurus&logoColor=white"
      alt="Documentation"
    />
  </a>
  <a href="https://commandcenterdemo.jose-f0b.workers.dev/login">
    <img
      src="https://img.shields.io/badge/live-demo-E8A23C?style=flat-square&logo=cloudflare&logoColor=white"
      alt="Live demo"
    />
  </a>
  <a href="https://github.com/mainsequence-sdk/CommandCenter/pulls">
    <img
      src="https://img.shields.io/badge/PRs-welcome-61C8FF?style=flat-square"
      alt="PRs welcome"
    />
  </a>
  <a href="https://github.com/mainsequence-sdk/CommandCenter/issues">
    <img
      src="https://img.shields.io/github/issues/mainsequence-sdk/CommandCenter?style=flat-square&label=Open%20Issues"
      alt="Open issues"
    />
  </a>
  <a href="https://github.com/mainsequence-sdk/CommandCenter/commits/main">
    <img
      src="https://img.shields.io/github/last-commit/mainsequence-sdk/CommandCenter?style=flat-square&label=Last%20commit"
      alt="Last commit"
    />
  </a>
  <a href="https://github.com/mainsequence-sdk/CommandCenter/pulse">
    <img
      src="https://img.shields.io/badge/Maintained-actively-5FB4FF?style=flat-square"
      alt="Actively maintained"
    />
  </a>
</p>

<p align="center">
  <a href="./LICENSE">
    <img
      src="https://img.shields.io/badge/license-Apache%202.0-121A29?style=flat-square"
      alt="Apache 2.0 license"
    />
  </a>
  <a href="./CONTRIBUTING.md">
    <img
      src="https://img.shields.io/badge/Contributing-guide-121A29?style=flat-square"
      alt="Contributing guide"
    />
  </a>
  <a href="./CODE_OF_CONDUCT.md">
    <img
      src="https://img.shields.io/badge/Code%20of%20Conduct-Contributor%20Covenant-121A29?style=flat-square"
      alt="Code of Conduct"
    />
  </a>
  <a href="https://github.com/mainsequence-sdk/CommandCenter#run-it">
    <img
      src="https://img.shields.io/badge/App-Run%20Locally-121A29?style=flat-square&logo=react&logoColor=white"
      alt="Run locally"
    />
  </a>
</p>

# Main Sequence Command Center

Main Sequence Command Center is an open-source frontend platform for teams that need to ship
branded financial products, internal consoles, and domain-specific workflows fast.

Instead of rebuilding navigation, permissions, dashboards, theming, and extension wiring for every
new product, teams can extend one platform and shape it into something that feels purpose-built.

This repository is still early, but the direction is already clear:

- extension-first architecture
- code-first dashboards and widgets
- theme-driven customization
- RBAC-ready application structure
- maximum reuse of community components and patterns

## What it is today

The current app already provides a strong foundation for a customizable market-facing product:

### Core stack

- Vite + React + TypeScript
- TanStack Query for async state
- Zustand for app and session state
- react-i18next + i18next for runtime language switching
- extension registry for widgets, apps, surfaces, and themes
- runtime theme overrides with TypeScript export
- RBAC metadata across routes, apps, surfaces, widgets, and actions
- mock REST and WebSocket adapters for local development

### Optional component integrations

These are shipped as optional extensions, not part of the main library:

- AG Grid for table-heavy workflows
- Lightweight Charts for market widgets

Both can be replaced without changing the overall extension model of the terminal.

## Project spirit

Command Center is being shaped as a frontend platform rather than a one-off app.

- Add new capabilities by shipping modules instead of rewriting the shell.
- Compose dashboards in TypeScript instead of maintaining brittle JSON editors.
- Organize product domains as apps and place dashboards, pages, or tools inside them.
- Keep theming token-based so teams can customize the experience deeply without forking the architecture.
- Prefer reusable community components when they are good enough, and keep integration boundaries clean when they are not.
- Stay pragmatic: make the platform easy for product teams to adopt, not just architecturally pure.

## Run it

```bash
npm install
npm run dev
```

Use `.env.example` as the starting point for data mode:

```bash
cp .env.example .env
```

`VITE_USE_MOCK_DATA=true` keeps the shell on local mock adapters and leaves the built-in `Demo` app registered. Set `VITE_USE_MOCK_DATA=false` to route the app through the live REST adapters configured by `VITE_API_BASE_URL`, the terminal/market websocket adapters configured by `VITE_WS_URL`, and the assistant server root configured by `VITE_ASSISTANT_UI_ENDPOINT`, and to remove the `Demo` app from navigation and app redirects. In local dev, the recommended setup is `VITE_ASSISTANT_UI_ENDPOINT=/__assistant__` plus `VITE_ASSISTANT_UI_PROXY_TARGET=http://192.168.1.253:8787`, so the browser talks to Vite and Vite proxies assistant requests to the LAN host.

`VITE_BYPASS_AUTH=true` bypasses backend authentication for local development and re-enables the built-in role picker.

`VITE_INCLUDE_WEBSOCKETS=true` keeps the websocket layer enabled. Set `VITE_INCLUDE_WEBSOCKETS=false` to stop the shell from opening the terminal socket connection and to disable streaming price subscriptions without changing the rest of the live REST mode.

`VITE_INCLUDE_AUI=true` keeps the detachable `assistant-ui` shell enabled. Set `VITE_INCLUDE_AUI=false` to remove the chat provider, sidebar trigger, overlay rail, and `/app/chat` route at runtime.

`VITE_INCLUDE_WORKSPACES=true` keeps the `Workspaces` application registered. Set `VITE_INCLUDE_WORKSPACES=false` to remove the `workspace-studio` app from navigation, search, topbar favorites, and routed app resolution.

Authentication is configured separately in `config/command-center.yaml` with the JWT token, refresh, and user-details endpoints.

## Live demo

[Open the demo login](https://commandcenterdemo.jose-f0b.workers.dev/login)

## Documentation

- [Documentation Index](./docs/README.md)
- [Architecture](./docs/architecture.md)
- [Apps and Surfaces](./docs/apps-and-surfaces.md)
- [Core Widgets](./docs/core-widgets.md)
- [Dashboard Layouts](./docs/dashboard-layouts.md)
- [Configuration](./docs/configuration.md)
- [Internationalization](./docs/internationalization.md)
- [Extensions](./docs/extensions.md)
- [Theming](./docs/theming.md)
- [Backend and Auth Integration](./docs/backend-and-auth.md)
- [Notifications](./docs/notifications.md)
- [RBAC Assignment Matrix](./docs/rbac-assignment-matrix.md)

The documentation site is served by Docusaurus:

- `npm install --prefix docs-site`
- `npm run docs:dev`
- `npm run docs:build`
- local docs URL: `http://localhost:3000/docs/`

## Configuration

User-facing branding now lives outside the app source:

- [command-center.yaml](./config/command-center.yaml)
- [`config/branding/logo_lightmode.png`](./config/branding/logo_lightmode.png)
- [`config/branding/logo_darkmode.png`](./config/branding/logo_darkmode.png)
- [`config/branding/logo_mark.png`](./config/branding/logo_mark.png)

The app reads the YAML config and resolves theme-aware logos from the `config/branding/` directory so branding can be changed without editing component code.

The same YAML file also controls auth integration:

- auth base URL
- token and refresh endpoints
- post-login user-details endpoint
- request/response field mappings
- RBAC claim and group mappings used to build the frontend session

Runtime data mode is controlled separately through Vite env vars:

- `VITE_USE_MOCK_DATA=true|false`
- `VITE_API_BASE_URL=http://127.0.0.1:8000`
- `VITE_WS_URL=ws://localhost:8000/ws`
- `VITE_INCLUDE_WEBSOCKETS=true|false`
- `VITE_INCLUDE_AUI=true|false`
- `VITE_INCLUDE_WORKSPACES=true|false`

## High-level structure

```text
extensions/
  main_sequence/      repo-root new app scaffold
src/
  app/
    guards/             route + permission guards
    layout/             shell, sidebar, topbar
    providers/          query, theme, app providers
    registry/           extension loading
  auth/                 roles, permissions, session store
  components/           shared UI and brand primitives
  data/                 adapter boundary plus mock/live implementations
  extensions/
    core/               built-in widgets, apps, surfaces, themes
    ag-grid/            optional grid integration
    lightweight-charts/ optional chart integration
  features/
    applications/       custom page/tool surfaces rendered inside apps
    apps/               app routing, home redirects, legacy redirects
    auth/               login
    dashboards/         dashboard canvas
    widgets/            widget catalog
    themes/             theme studio
    access/             RBAC explorer
  themes/               token model, provider, snippet generator
  widgets/              core primitives plus extension-owned widgets
```

## Core ideas

### Widgets are definitions, not hard-coded pages

Every widget exports metadata and a React component so it can be registered, permissioned, themed, and reused consistently.

```ts
export const marketKpisWidget: WidgetDefinition<{ symbol?: string }> = {
  id: "market-kpis",
  title: "Market KPIs",
  description: "Small summary cards for desk and risk metrics.",
  category: "Market",
  kind: "kpi",
  source: "core",
  defaultSize: { w: 4, h: 4 },
  requiredPermissions: ["dashboard:view"],
  exampleProps: { symbol: "AAPL" },
  component: MarketKpisWidget,
};
```

### Dashboards are code-defined compositions

Dashboards stay explicit and versionable. The current repo does not depend on persisted drag-and-drop layout builders, but dashboards now resolve through an auto-packing grid so panels fit without hand-maintained `y` math.

```ts
export const overviewDashboard: DashboardDefinition = {
  id: "overview",
  title: "Demo Overview",
  description: "Default demo dashboard built from core widgets only.",
  source: "core",
  requiredPermissions: ["dashboard:view"],
  widgets: [
    {
      id: "overview-kpis",
      widgetId: "market-kpis",
      title: "Desk KPIs",
      props: { symbol: "AAPL" },
      layout: { cols: 4, rows: 4 },
      position: { x: 0 }
    }
  ]
};
```

### Apps own many surfaces

The shell is organized around apps first.

User flow:

1. Pick an app from the left rail.
2. Land on that app's default home surface.
3. Navigate dashboards, pages, or tools within the app.
4. Use global search to jump across apps, surfaces, and utility actions.

This keeps the information architecture stable as new workflows are added:

- left rail = product domains
- on-demand app panel = visible surfaces for the clicked app
- topbar selector = surfaces inside the selected app
- app name in topbar = app details and metadata
- dashboard = monitoring surface
- page = review or exploration surface
- tool = action-oriented surface

### Themes are token objects

Theming is meant to be a first-class extension surface, not a late-stage patch.

```ts
export const graphiteTheme: ThemePreset = {
  id: "graphite",
  label: "Graphite",
  description: "Dark default terminal theme.",
  mode: "dark",
  tokens: {
    background: "#0B1017",
    primary: "#4F8CFF",
    accent: "#10B981",
    radius: "16px",
  },
};
```

### RBAC is metadata-driven in the UI

Routes, dashboards, and widgets declare `requiredPermissions`. The frontend uses that metadata to filter navigation, lock views, and explain access decisions while the backend remains the source of truth.

## How to extend it

### Add a widget

1. Create a component under `src/widgets/...`.
2. Export a `WidgetDefinition`.
3. Register it in an extension.

### Add an app

1. Create an `AppDefinition`.
2. Choose its icon, default home surface, and permissions.
3. Add one or more surfaces to it.
4. Register the app in an extension entrypoint under `src/extensions/*/index.ts` or `extensions/*/index.ts`, and keep the app pages/tools under that same extension tree.

### Add a dashboard surface

1. Create a `DashboardDefinition`.
2. Compose registered widget IDs.
3. Add a surface with `kind: "dashboard"` to an app.

### Add a page or tool surface

1. Create a React component.
2. Add a surface with `kind: "page"` or `kind: "tool"` to an app.
3. Register the owning app in an extension.

Extension authoring rules for URL params, filtered registries, selection hooks, and outside-click behavior are documented in [Extensions](./docs/extensions.md#state-and-navigation-safety).

### Add a theme

1. Create a `ThemePreset`.
2. Add it to an extension.
3. The theme studio will load it automatically.

## Extension loading

The registry auto-loads modules from:

```text
src/extensions/*/index.ts
extensions/*/index.ts
```

Each extension exports:

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

See `src/extensions/lightweight-charts/index.ts` for a bundled widget extension and `src/extensions/core/apps/access-rbac/` for a bundled app implementation.

Optional vendor integrations live in their own extensions, for example `src/extensions/ag-grid/index.ts` and `src/extensions/lightweight-charts/index.ts`.

## Adapting to your backend

The app selects the active adapter layer through `VITE_USE_MOCK_DATA`.

Mock mode uses:

- `src/data/demo-api.ts`
- `src/data/mock/terminal-socket.ts`

Live mode uses:

- `src/data/live/rest-api.ts`
- `src/data/live/terminal-socket.ts`

Recommended mapping:

- REST for snapshots, search, historical data, and mutations
- WebSocket for prices, order updates, notifications, and presence

## Notes

- Theme state is intentionally not persisted yet. Add Zustand `persist` when saved preferences or per-app state become important.
- Dashboards are still code-defined, but they now live inside apps as one surface type among dashboards, pages, and tools.
- If you choose to ship Lightweight Charts publicly through the optional charts extension, review its attribution requirement before production rollout.
