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

- Access & RBAC is organization-admin-facing. It no longer shares the same access gate as the
  platform-only `Admin Settings` modal.
- Access & RBAC appears as its own top-level section inside the routed Settings page, gated by
  `org_admin:view`. Keep the standalone app registration available for legacy/deep-link metadata,
  but do not expose it as a separate primary sidebar app.
- The conceptual RBAC overview now lives in the Documentation app under
  `Organization Admin -> RBAC`. The legacy `/app/access-rbac/overview` route is retained only as a
  redirect, and `Overview` is no longer part of the normal Access & RBAC navigation.
- The policy editor is no longer part of normal Access & RBAC navigation. Shell profile definition
  and assignment are backend-owned; the frontend reads resolved shell access only.
- Backend policy/bootstrap flows should derive app and surface coverage from the generated access
  catalog in `src/app/registry/access-catalog-sync.ts`, which includes all registered surfaces,
  including hidden deep-link surfaces.
- The shell app gates now use app-level permissions: `workspaces:view`,
  `main_sequence_markets:view`, and `main_sequence_foundry:view`.
- The `User access inspector` surface reads
  `/api/v1/command_center/users/<user_uid>/shell-access/` and renders the returned
  `accessible_apps` / `accessible_surfaces` as a read-only application and submenu tree.
- The Teams surface is now registry-first and links into a dedicated detail route for each team.
- Team detail routes stay inside the Access & RBAC shell and force the sidebar highlight to remain on the `Teams` surface.
