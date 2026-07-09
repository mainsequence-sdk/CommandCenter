# Access & RBAC

This Settings section is owned by the core extension.

Keep the full app implementation in this folder:

- Settings pages
- shared RBAC surface layout
- user directory adapter for the inspector
- teams list and team-detail surfaces that belong with Access & RBAC

The Settings catalog entries stay in:

- `src/extensions/core/index.ts`

This follows the platform extension rule: extension-owned apps should live under their owning
extension tree instead of generic feature folders.

Notable behavior:

- Access & RBAC is organization-admin-facing. It is gated only by backend-returned
  `settings.access-rbac.*` shell surfaces.
- Access & RBAC appears as its own top-level section inside the routed Settings page when the
  backend shell-access response includes the matching Settings surfaces. There is no standalone
  `access-rbac` app registration.
- The conceptual RBAC overview now lives in the Documentation app under
  `Organization Admin -> RBAC`. `Overview` is no longer part of the normal Access & RBAC
  navigation.
- The policy editor is no longer part of normal Access & RBAC navigation. Shell-access definition
  and assignment are backend-owned; the frontend reads resolved shell access only.
- Backend shell-access resolution owns app and surface coverage. The frontend uses
  `accessible_apps` as app/section prefix scopes.
- The `User access inspector` surface reads
  `/api/v1/command_center/users/<user_uid>/shell-access/` and renders the returned
  app/section scopes as a read-only application and submenu tree.
- The Teams surface is now registry-first and links into a dedicated detail route for each team.
- Team detail routes stay under `/app/settings/access-rbac/teams/:teamId` and use the same
  `settings.access-rbac.teams` shell surface as the teams registry.
