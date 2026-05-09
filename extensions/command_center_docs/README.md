# Command Center Docs Extension

This extension owns user-facing Command Center documentation that should be available inside the
application shell. It is intentionally separate from the repository-level `docs/` tree, which is
developer documentation for maintainers.

## Entry Points

- `index.ts`: registers the extension with the shell extension registry.
- `app.ts`: defines the Documentation app, its navigation surfaces, and assistant context.
- `DocumentationPage.tsx`: renders a documentation surface from local content metadata.
- `content/`: stores the user-facing Markdown guide content imported by the app.

## Documentation Boundary

- Put general user guidance for Command Center here.
- Keep architecture, implementation contracts, ADRs, deployment notes, and maintainer guides in
  `docs/` or the nearest module `README.md`.
- Put product-specific user guidance inside the owning product extension when it is not generally
  applicable to Command Center. For example, Main Sequence Foundry or Markets usage notes should
  live under `extensions/main_sequence/`.

## Backend Contract

The initial implementation is static frontend content imported at build time. It does not change
workspace storage, widget state, runtime state, serialized bindings, or backend API contracts.
