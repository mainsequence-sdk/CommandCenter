# Access & RBAC

This app is owned by the core extension.

Keep the full app implementation in this folder:

- page surfaces
- shared RBAC surface layout
- user directory adapter for the inspector
- teams list and team-detail surfaces that belong with Access & RBAC

Registration stays in:

- `src/extensions/core/index.ts`

This follows the platform extension rule: extension-owned apps should live under their owning
extension tree instead of generic feature folders.

Notable behavior:

- The Teams surface is now registry-first and links into a dedicated detail route for each team.
- Team detail routes stay inside the Access & RBAC shell and force the sidebar highlight to remain on the `Teams` surface.
