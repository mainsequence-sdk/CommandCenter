# Access & RBAC App

## Overview

Access control in Command Center no longer needs to live as a single utility page. When governance
work grows, the platform supports a dedicated admin app so policy review, assignments, and
entitlement coverage can scale as a real product surface.

In the core extension, that app is `Access & RBAC`.

Its implementation now lives under:

- `src/extensions/core/apps/access-rbac/`

It lives in the admin menu, not in the primary left rail, and it is permission-gated with
`org_admin:view`.

The app manages its own surface menu inside the page itself, so its navigation does not leak into
the global topbar.

## Why it is an app

This matters once access management becomes substantial.

A standalone admin app gives you:

- multiple surfaces instead of one overloaded page
- grouped in-app navigation
- favorites support for admin views
- searchability through the same app-and-surface model as the rest of the platform
- a clean separation between policy, assignments, operational review, and user inspection
- a clean separation between organization-admin workflows and the platform-only `Admin Settings`
  modal

## Surface model

The shipped `Access & RBAC` app is organized into six surfaces:

- `Overview`: governance model only
- `Policies`: backend-backed Command Center shell policy studio
- `Main Sequence access`: reference page for Main Sequence object-level user and team assignments
- `Coverage`: effective shell access across apps, surfaces, widgets, and utilities
- `User access inspector`: lookup one user, edit shell-access assignments, and inspect the resulting effective coverage
- `Teams`: organization team registry, membership management, and sharing

Those surfaces are grouped into three sections:

- `User access inspection`
- `Teams`
- `Concept & Help`

That grouping is declared in the app registry, not hardcoded in the navigation UI.

## Registration pattern

Register the app like any other `AppDefinition`, but place it in the admin menu:

```ts
const informationSection = {
  id: "information",
  label: "Concept & Help",
  order: 40,
};

const inspectionSection = {
  id: "inspection",
  label: "User access inspection",
  order: 30,
};

const teamsSection = {
  id: "teams",
  label: "Teams",
  order: 35,
};

const accessRbacApp: AppDefinition = {
  id: "access-rbac",
  title: "Access & RBAC",
  description: "Administrative application for policy review and assignments.",
  source: "core",
  icon: KeyRound,
  navigationPlacement: "admin-menu",
  topNavigationStyle: "hidden",
  requiredPermissions: ["org_admin:view"],
  defaultSurfaceId: "overview",
  surfaces: [
    {
      id: "overview",
      title: "Overview",
      kind: "page",
      navigationSection: informationSection,
      component: AccessRbacOverviewPage,
    },
    {
      id: "assignments",
      title: "Main Sequence object access",
      kind: "page",
      navigationSection: informationSection,
      component: AccessRbacAssignmentsPage,
    },
    {
      id: "user-inspector",
      title: "Organization user inspector",
      kind: "page",
      navigationSection: inspectionSection,
      component: AccessRbacInspectorPage,
    },
    {
      id: "teams",
      title: "Teams",
      kind: "page",
      navigationSection: teamsSection,
      component: AccessRbacTeamsPage,
    },
  ],
};
```

## Legacy compatibility

The legacy `/app/access` route can stay alive as a redirect to the app surface:

```ts
<Navigate to="/app/access-rbac/overview" replace />
```

That keeps old links working while the platform converges on the app-and-surfaces model.

The legacy `/app/teams` route can also redirect into the RBAC app:

```ts
<Navigate to="/app/access-rbac/teams" replace />
```

## Reusable control layer

The object assignment surface is intentionally built around the reusable
`RbacAssignmentMatrix` component.

That means teams can mount the same control in:

- project detail flows
- secret management
- job governance
- custom extension resources

The app owns the orchestration and explanation. The component owns the assignment interaction.

The policies surface now follows the same pattern with `RbacPolicyStudio`.

That component provides:

- CRUD against `/api/v1/command_center/access-policies/`
- `slugified_name` as the visible policy key while detail routes still use integer ids
- fixed built-in `light-user`, `dev-user`, and `org-admin-user` policies that stay read-only in the org-admin UI
- hidden backend-enforced admin-class policies such as `admin` and `platform-admin`
- editable shell permission bundles

The shell app access model is now explicit:

- `workspaces:view` unlocks the Workspaces shell app
- `main_sequence_markets:view` unlocks Main Sequence Markets
- `main_sequence_foundry:view` unlocks Main Sequence Foundry

The User Inspector complements that by managing `/api/v1/command_center/users/<user_id>/shell-access/`
for one user at a time.

That inspector:

- assigns visible custom policies to the user
- applies direct grants and direct denies
- previews the resolved `effective_permissions` before saving
- computes app, surface, widget, and utility visibility from the backend response

The app owns the current Command Center policy model and shell-access contract. The reusable
studio/inspector UI owns the editing interaction.
