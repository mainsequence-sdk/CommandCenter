# Documentation

Main Sequence Command Center is the foundation for teams that want to launch branded market
products, internal operating consoles, and extension-driven workflows without rebuilding the shell
from scratch every time.

These docs are here to show how the platform comes together and how you can turn it into a
product surface that feels deliberate, fast, and deeply customized to your own domain.

## Recommended reading order

1. [Architecture](./architecture.md)
2. [Apps and Surfaces](./apps-and-surfaces.md)
3. [Core Widgets](./core-widgets.md)
4. [Dashboard Layouts](./dashboard-layouts.md)
5. [Workspaces](./workspaces.md)
6. [Configuration](./configuration.md)
7. [Internationalization](./internationalization.md)
8. [Extensions](./extensions.md)
9. [Theming](./theming.md)
10. [Backend and Auth Integration](./backend-and-auth.md)
11. [Notifications](./notifications.md)
12. [RBAC Assignment Matrix](./rbac-assignment-matrix.md)
13. [Access & RBAC App](./access-rbac-app.md)

## Why it exists

Command Center is an extension-first frontend platform for financial and operational products. It
is built for teams that want to move faster on product delivery without giving up structure,
branding control, or permission boundaries.

The core shell stays focused on the parts every serious product needs:

- app shell and routing
- role and permission checks
- theme registry and runtime token overrides
- widget, app, surface, and theme registry
- mock REST and WebSocket adapters for local development

Everything more specific, more opinionated, or more product-driven belongs in extensions.

Vendor-specific charting or grid libraries are not treated as core platform dependencies. Those
live in optional extensions where teams can evolve the experience without hardwiring the platform
to one stack forever.

## Extension inventory

The current repository ships with these extensions:

- `core`: base widgets, apps, surfaces, and themes
- `ag-grid`: optional data-grid widget integration
- `lightweight-charts`: optional market chart integration
- `flow-lab`: bundled extension that contributes a custom widget and theme to demo surfaces
- `main_sequence`: repo-root product namespace with separate Workbench and Markets extensions

## Local development

```bash
npm install
npm run dev
```

To run the public documentation site:

```bash
npm install --prefix docs-site
npm run docs:dev
```

For type-checking:

```bash
npm run check
```
