# RBAC

RBAC in Command Center works at two different levels:

- platform access inside Command Center
- object-level access inside Main Sequence

Understanding that split is important, because a user can be allowed to open or manage parts of
the platform without automatically gaining access to every governed object inside Main Sequence.

## Command Center

At the Command Center level, RBAC decides what a user can see and operate in the platform.

### Authentication and session

The process starts with authentication. Once a user signs in, Command Center builds the active
session for that identity. That session carries the user record, the current access class, and the
effective permissions used throughout the platform.

### Organization access class

After identity is resolved, Command Center determines platform access from the dedicated
shell-access flow and uses the returned `effective_permissions` as the source of truth for
organization-admin access.

### Resolution flow

```text
backend user details / JWT claims
        |
        +-- identity bootstrap ----------------------> signed-in user profile
        |
        +-- /command_center/access-policies/ --------> reusable platform policy definitions
        |
        +-- /command_center/users/<user_uid>/shell-access/ -> user policy assignments plus direct grants/denies
        |                                              resolve into effective permissions
        |
        +-- effective_permissions --------------------> platform gates decide what is visible,
                                                       searchable, and reachable
```

### Permission gates

Permissions are the real enforcement layer inside Command Center.

Policies and user-specific overrides determine whether apps, pages, tools, widgets, and utilities
are visible and reachable. This is what controls the platform experience for organization-admin
workflows.

## Main Sequence

Main Sequence uses a more granular object-access model on top of the platform layer.

That means Command Center access and Main Sequence resource access are related, but they are not
the same thing.

### Resource assignments

Object-level RBAC in Main Sequence is separate from the Command Center access class.

An individual Main Sequence resource can grant direct `view` or `edit` access to a user or team
without changing whether Command Center treats that person as an Admin or a User at the platform
level.

## Why The Split Matters

This separation helps the platform stay predictable:

- Command Center decides what parts of the platform a user can access
- Main Sequence decides which governed objects that user can view or edit

In practice, this means a person may be allowed to use the admin or governance tools in Command
Center while still having tightly controlled access to specific projects, resources, or teams
inside Main Sequence.
