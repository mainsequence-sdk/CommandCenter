# Access & RBAC App

## Overview

Access control in Command Center no longer needs to live as a single utility page. When governance
work grows, the platform supports a dedicated admin app so policy review, assignments, and
entitlement coverage can scale as a real product surface.

In the core extension, that app is `Access & RBAC`.

Its implementation now lives under:

- `src/extensions/core/apps/access-rbac/`

It lives in the admin menu, not in the primary left rail, and it is permission-gated with
`rbac:view`.

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

## Surface model

The shipped `Access & RBAC` app is organized into six surfaces:

- `Overview`: governance model only
- `Policies`: shell policy studio with local save plus fetched RBAC-group assignment
- `Main Sequence access`: reference page for Main Sequence object-level user and team assignments
- `Coverage`: effective shell access across apps, surfaces, widgets, and utilities
- `User access inspector`: lookup and inspect one user at a time
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
  requiredPermissions: ["rbac:view"],
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
      title: "User access inspector",
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

- local browser persistence for draft shell policies
- fetched RBAC group assignment from `access_rbac.groups.list_url`
- fixed configured Admin group mapping
- editable shell permission bundles

The app owns the current Command Center policy model. The reusable studio owns the editing
interaction and persistence behavior.
