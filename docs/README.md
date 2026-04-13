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
7. [ADR: Shared Workspace Content vs Per-User View State](./adr/adr-shared-workspace-state.md)
8. [ADR: Use React Grid Layout v2 API in Workspace Studio](./adr/adr-rgl-v2-workspace-studio.md)
9. [ADR: First-Class Widget Bindings and Dependency Graph](./adr/adr-widget-bindings-and-dependency-graph.md)
10. [ADR: AppComponent as a Binding-Native API Widget](./adr/adr-app-component-binding-native-api-widget.md)
11. [ADR: Shared AppComponent Discovery and Safe-Response Caching](./adr/adr-app-component-caching.md)
12. [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr/adr-binding-output-transforms.md)
13. [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr/adr-executable-widget-graph-runner.md)
14. [ADR: Source-Driven Downstream Execution After Manual Widget Actions](./adr/adr-source-driven-downstream-execution.md)
15. [ADR: Headless Workspace Widget Settings Runtime](./adr/adr-headless-workspace-settings-runtime.md)
16. [ADR: Single Runtime Owner for Workspace Widgets](./adr/adr-single-runtime-owner-workspace-widgets.md)
17. [ADR: Agent-Ready Widget Type Registry Contract](./adr/adr-agent-ready-widget-type-registry-contract.md)
18. [ADR: Incremental Workspace Normalization and Resource-Scoped Save](./adr/adr-incremental-workspace-normalization.md)
19. [Workspace Runtime Performance Remediation](./workspace-runtime-performance-remediation.md)
20. [Workspace Settings Headless Runtime Investigation](./workspace-settings-headless-runtime-investigation.md)
21. [Configuration](./configuration.md)
22. [Internationalization](./internationalization.md)
23. [Extensions](./extensions.md)
24. [Theming](./theming.md)
25. [Backend and Auth Integration](./backend-and-auth.md)
26. [Deployment](./deployment.md)
27. [Notifications](./notifications.md)
28. [RBAC Assignment Matrix](./rbac-assignment-matrix.md)
29. [Access & RBAC App](./access-rbac-app.md)

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
