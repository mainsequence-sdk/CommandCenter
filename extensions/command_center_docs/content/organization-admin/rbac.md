# RBAC

RBAC in Command Center works at two different levels:

- platform access inside Command Center
- object-level access inside Main Sequence

Understanding that split is important, because a user can be allowed to open or manage parts of
the platform without automatically gaining access to every governed object inside Main Sequence.

## Command Center

At the Command Center level, RBAC decides what shell applications and submenus a user can see.
Backend APIs still enforce their own resource and action permissions.

### Authentication and session

The process starts with authentication. Once a user signs in, Command Center builds the active
session for that identity. That session carries the user record, the current access class, and the
effective permissions used throughout the platform.

### Organization access class

After identity is resolved, Command Center determines shell visibility from the dedicated
shell-access flow. `accessible_apps` carries app and section scopes such as `settings` or
`settings.access-rbac`. Raw permission strings are not part of the normal shell-access read
response.

### Resolution flow

```text
backend user details / JWT claims
        |
        +-- identity bootstrap ----------------------> signed-in user profile
        |
        +-- backend-owned shell profiles ------------> app and submenu selections
        |
        +-- /command_center/users/<user_uid>/shell-access/ -> resolved app/surface access
        |
        +-- accessible_apps prefix scopes ------------> shell gates decide what is visible,
                                                       searchable, and reachable
```

### Permission gates

Shell access is a visualization gate inside Command Center.

Backend-owned profiles determine whether apps and submenus are visible and reachable. Organization
admins inspect the resolved tree in Access & RBAC; they do not edit raw policy bundles, direct
grants, or direct denies from the frontend.

## Main Sequence

Main Sequence uses a more granular object-access model on top of the platform layer.

That means Command Center access and Main Sequence resource access are related, but they are not
the same thing.

### Resource assignments

Object-level RBAC in Main Sequence is separate from the Command Center access class.

An individual Main Sequence resource can grant direct `view` or `edit` access to a user or team
without changing whether Command Center treats that person as an Admin or a User at the platform
level.

Actual object permissions are edited from the resource detail pages that own the object, such as
projects, secrets, constants, namespaces, data nodes, and similar Main Sequence resources. The RBAC
settings pages explain and inspect platform access; they do not pick a Main Sequence object for
editing.

For Main Sequence objects, the common rules are:

- organization admins retain access even when they are not explicitly assigned
- edit access implies view access
- assignments are made to users and organization teams, not ad-hoc groups

## Why The Split Matters

This separation helps the platform stay predictable:

- Command Center decides what parts of the platform a user can access
- Main Sequence decides which governed objects that user can view or edit

In practice, this means a person may be allowed to use the admin or governance tools in Command
Center while still having tightly controlled access to specific projects, resources, or teams
inside Main Sequence.
