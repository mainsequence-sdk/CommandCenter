# User Documentation Content

This directory contains the user-facing Markdown pages rendered by the Command Center Docs
extension.

## Content Rules

- Write for application users, not maintainers.
- Prefer task-oriented pages that explain what users can do in the product.
- Do not document implementation details, backend contracts, ADR rationale, or extension internals
  here. Link maintainers to repository-level `docs/` when that context is needed.
- Keep general Command Center guidance here and product-specific guidance inside the owning product
  extension.

## Navigation

Add new pages to `docsContent.ts` so they appear in the shared documentation registry.

Organize the markdown files by the same top-level section structure used by the documentation menu.
Each top-level section should own its own subdirectory under `content/`.

Keep the navigation application-first:

- top-level sections are limited to the approved documentation applications
- each top-level section owns an ordered submenu
- child pages should be ordered inside the owning application
- generated child pages should stay aligned with the real application surface structure
