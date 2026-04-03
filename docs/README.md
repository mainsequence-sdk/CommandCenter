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
6. [Workspace Backend Model](./workspace-backend-model.md)
7. [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)
8. [ADR: Use React Grid Layout v2 API in Workspace Studio](./adr-rgl-v2-workspace-studio.md)
9. [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
10. [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
11. [ADR: Shared AppComponent Discovery and Safe-Response Caching](./adr-app-component-caching.md)
12. [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
13. [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
14. [ADR: Headless Workspace Widget Settings Runtime](./adr-headless-workspace-settings-runtime.md)
15. [ADR: Incremental Workspace Normalization and Resource-Scoped Save](./adr-incremental-workspace-normalization.md)
16. [Workspace Runtime Performance Remediation](./workspace-runtime-performance-remediation.md)
17. [Workspace Settings Headless Runtime Investigation](./workspace-settings-headless-runtime-investigation.md)
18. [Configuration](./configuration.md)
19. [Internationalization](./internationalization.md)
20. [Extensions](./extensions.md)
21. [Theming](./theming.md)
22. [Backend and Auth Integration](./backend-and-auth.md)
23. [Deployment](./deployment.md)
24. [Notifications](./notifications.md)
25. [RBAC Assignment Matrix](./rbac-assignment-matrix.md)
26. [Access & RBAC App](./access-rbac-app.md)

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
