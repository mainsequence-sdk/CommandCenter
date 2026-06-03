# Command Center Docs Extension

This extension owns user-facing Command Center documentation that should be available inside the
application shell. It is intentionally separate from the repository-level `docs/` tree, which is
developer documentation for maintainers.

## Entry Points

- `index.ts`: registers the extension with the shell extension registry.
- `app.ts`: defines the Documentation app, its navigation surfaces, and assistant context.
- `DocumentationPage.tsx`: renders a documentation surface from local content metadata.
- `content/`: stores the user-facing Markdown guide content imported by the app.

## Access Model

This extension is part of the signed-in Command Center experience.

- documentation is available through the normal Documentation app
- documentation is visible to signed-in users only
- this extension does not define a public anonymous documentation surface

## Documentation Boundary

- Put general user guidance for Command Center here.
- Keep architecture, implementation contracts, ADRs, deployment notes, and maintainer guides in
  `docs/` or the nearest module `README.md`.
- Put product-specific user guidance inside the owning product extension when it is not generally
  applicable to Command Center. For example, Main Sequence Foundry usage notes should live under
  `extensions/main_sequence/`.

## Ownership Model

The navigation model for this extension is application-first.

- The left documentation rail is limited to the approved top-level sections:
  `Getting Started`, `Workspaces`, `Foundry`, `Main Sequence AI`, and
  `Organization Admin`.
- Each top-level section opens its own ordered submenu.
- Nested pages should be ordered inside the owning application section.
- Foundry and Main Sequence AI child pages should stay aligned with the real application surface
  inventory whenever possible.
- Avoid introducing generic documentation-only categories when the content really belongs to one
  application or extension.
- The in-page docs layout should render only one internal navigation rail at a time. Multi-page
  sections use the current section submenu, while single-page sections can fall back to the
  top-level documentation directory.
- Keep the docs surface visually flatter than the main app shell. Avoid stacking card containers
  around the section rails and article body unless a callout truly needs separation.

## Backend Contract

The initial implementation is static frontend content imported at build time. It does not change
workspace storage, widget state, runtime state, serialized bindings, or backend API contracts.
