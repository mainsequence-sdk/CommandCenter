# Access & RBAC App

## Overview

Access control in Command Center no longer lives as a loose utility page. It is an organization
admin section inside Settings for inspecting shell visibility and opening team administration.

In the core extension, that section is `Access & RBAC`.

Its implementation now lives under:

- `src/extensions/core/apps/access-rbac/`

It lives in Settings under `Access & RBAC`, not in the primary left rail. It is gated by the
backend shell-access response using `settings.access-rbac` as the app id and concrete Settings
surface ids such as `settings.access-rbac.inspector` and `settings.access-rbac.teams`.

## Why it is an app

This matters once access management becomes substantial.

A dedicated settings section gives you:

- focused routes instead of one overloaded page
- grouped Settings navigation
- searchability through the same app-and-surface model as the rest of the platform
- a clean separation between resolved shell access inspection and team administration
- a clean separation between organization-admin workflows and the platform-only `Admin Settings`
  modal

## Surface model

The shipped `Access & RBAC` Settings section is organized around two normal surfaces:

- `Inspector`: lookup one user and inspect resolved shell access as applications and submenus
- `Teams`: organization team registry, membership management, and sharing

The conceptual RBAC overview lives in the Documentation app. Legacy `Overview`, `Policies`,
`Coverage`, and assignment surfaces are not registered shell apps or surfaces.

## Registration pattern

Register Access & RBAC as Settings surfaces on the core Settings catalog:

```ts
{
  id: "access-rbac/inspector",
  title: "Organization User Inspector",
  navigationSection: settingsAccessRbacSection,
}

{
  id: "access-rbac/teams",
  title: "Teams",
  navigationSection: settingsAccessRbacSection,
}
```

## Shell Access Contract

Access & RBAC no longer exposes a frontend policy editor. Shell-access definition and assignment
are backend-owned. The frontend calls
`/api/v1/command_center/users/<user_uid>/shell-access/` and renders the returned
`accessible_apps` scopes as a read-only tree.

The shell app access model stays top-down by backend-returned ids:

- `accessible_apps` lists app or section scopes such as `settings` or `settings.access-rbac`.
- A scope grants its full subtree: `app` allows `app.*`, and `app.section` allows
  `app.section.*`.
- The frontend does not translate roles, groups, or permission strings into shell access.

The normal shell-access read response does not include policy ids, `effective_permissions`,
`grant_permissions`, `deny_permissions`, or `surface_profiles`.

This contract does not change Teams, team membership, workspace sharing, object sharing, or
resource sharing. Those remain separate product models and backend authorization boundaries.
