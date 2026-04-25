# Command Center Docs

Command Center is a frontend platform for teams building internal products, operational consoles,
and extension-driven workflows without re-implementing the shell every time.

These docs are written for developers. Start here if you need to understand the platform quickly,
find the extension seam for a new feature, or change a subsystem without guessing how the rest of
the app fits together.

## Pick Your Starting Point

- [Platform](./platform/README.md): shell architecture, configuration, theming, internationalization,
  and notifications.
- [Apps](./apps/README.md): app and surface model, routing, and navigation.
- [Auth](./auth/README.md): backend integration and authentication boundaries.
- [Workspaces](./workspaces/README.md): workspace model, layout, persistence, and runtime notes.
- [Widgets](./widgets/README.md): widget concepts plus links to widget-local implementation docs.
- [Extensions](./extensions/README.md): how to add product surface area without polluting the shell.
- [Access Control](./access-control/README.md): RBAC primitives and the dedicated access app.
- [Operations](./operations/README.md): deployment and operational constraints.
- [ADRs](./adr/README.md): accepted and proposed design decisions.

## If You Are New Here

- Read [Platform](./platform/README.md), then [Apps](./apps/README.md), then
  [Widgets](./widgets/README.md), then [Workspaces](./workspaces/README.md).
- Use [Extensions](./extensions/README.md) when you are adding product-specific behavior and want
  to avoid polluting core.
- Use [ADRs](./adr/README.md) when the code feels more opinionated than the current docs explain.

## Authoring Rules

- Put docs under the owning domain folder. Workspace docs go in `docs/workspaces/`, auth docs go
  in `docs/auth/`, extension docs go in `docs/extensions/`, and so on.
- Every section folder must have a `README.md` that acts as the local index and reading order.
- Docs should not stop at description. Each section should explain what exists, how to extend it,
  and the guardrails that keep it maintainable.
- Widget-facing docs must point to the nearest widget implementation `README.md`.
- Extension-facing docs must point to the owning extension `README.md`.
- ADRs stay in `docs/adr/`. Do not scatter architectural decisions through feature folders.

## Recommended Reading Order

1. [Platform](./platform/README.md)
2. [Apps](./apps/README.md)
3. [Widgets](./widgets/README.md)
4. [Workspaces](./workspaces/README.md)
5. [Extensions](./extensions/README.md)
6. [Auth](./auth/README.md)
7. [Access Control](./access-control/README.md)
8. [Operations](./operations/README.md)
9. [ADRs](./adr/README.md)

## How To Use These Docs

- Read the section index first if you need the big picture.
- Read the detailed page next if you are changing one capability.
- Use widget and extension `README.md` files when you need the implementation-level contract for a
  specific module.

## Extension Inventory

The current repository ships with these extensions:

- `core`: base widgets, apps, surfaces, and themes
- `ag-grid`: optional data-grid widget integration
- `echarts`: optional spec-driven chart integration with organization-scoped widget configuration support
- `lightweight-charts`: optional market chart integration
- `main_sequence`: repo-root product namespace with separate Workbench and Markets extensions

## Local Development

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
