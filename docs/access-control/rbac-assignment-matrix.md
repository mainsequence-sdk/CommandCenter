# RBAC Assignment Matrix

`RbacAssignmentMatrix` is the reusable core-platform component for assigning object access to
individual users and teams.

It is designed for permission scopes such as:

- `view`
- `edit`
- `admin`
- `run`

The component does not impose permission semantics itself. Rules such as `edit implies view` stay
in the caller, where the product-specific authorization model belongs.

## File

`src/components/ui/rbac-assignment-matrix.tsx`

## What it solves

The component renders a dual-list transfer UI for each RBAC scope:

- left list: available users or teams
- center controls: move one or all items
- right list: selected users or teams

Each scope contains two assignment sections:

- `Users`
- `Teams`

Groups are intentionally not part of this component.

## Data model

### User option

```ts
interface RbacAssignableUser {
  id: string | number;
  email: string;
  name?: string;
  roleLabel?: string;
  description?: string;
}
```

### Team option

```ts
interface RbacAssignableTeam {
  id: string | number;
  name: string;
  memberCount?: number;
  description?: string;
}
```

### Scope definition

```ts
interface RbacAssignmentScope {
  id: string;
  title: string;
  description?: string;
  userHelperText?: string;
  teamHelperText?: string;
}
```

### Value shape

```ts
type RbacAssignmentValue = Record<
  string,
  {
    userIds: Array<string | number>;
    teamIds: Array<string | number>;
  }
>;
```

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `scopes` | `RbacAssignmentScope[]` | Required. Each scope renders one card. |
| `users` | `RbacAssignableUser[]` | Required. Available user candidates. |
| `teams` | `RbacAssignableTeam[]` | Required. Available team candidates. |
| `value` | `RbacAssignmentValue` | Optional controlled value. |
| `defaultValue` | `RbacAssignmentValue` | Optional uncontrolled initial value. |
| `onChange` | `(value: RbacAssignmentValue) => void` | Fired whenever assignments change. |
| `className` | `string` | Optional layout override. |

## Controlled usage

```tsx
import { useState } from "react";

import {
  RbacAssignmentMatrix,
  type RbacAssignmentScope,
  type RbacAssignmentValue,
} from "@/components/ui/rbac-assignment-matrix";

const scopes: RbacAssignmentScope[] = [
  {
    id: "view",
    title: "Can view",
    userHelperText: "Users on the right can view this object.",
    teamHelperText: "Teams on the right can view this object.",
  },
  {
    id: "edit",
    title: "Can edit",
    userHelperText: "Users on the right can edit this object.",
    teamHelperText: "Teams on the right can edit this object.",
  },
];

const users = [
  { id: 1, email: "jose@main-sequence.io", roleLabel: "Org Admin" },
  { id: 2, email: "ameer.uak@gmail.com", roleLabel: "User" },
];

const teams = [
  { id: 10, name: "Engineering Fixed Income", memberCount: 2 },
];

export function Example() {
  const [value, setValue] = useState<RbacAssignmentValue>({
    view: { userIds: [1], teamIds: [10] },
    edit: { userIds: [1], teamIds: [] },
  });

  return (
    <RbacAssignmentMatrix
      scopes={scopes}
      users={users}
      teams={teams}
      value={value}
      onChange={(nextValue) => {
        setValue({
          ...nextValue,
          view: {
            userIds: [...new Set([...nextValue.view.userIds, ...nextValue.edit.userIds])],
            teamIds: [...new Set([...nextValue.view.teamIds, ...nextValue.edit.teamIds])],
          },
          edit: nextValue.edit,
        });
      }}
    />
  );
}
```

## Uncontrolled usage

```tsx
<RbacAssignmentMatrix
  scopes={scopes}
  users={users}
  teams={teams}
  defaultValue={{
    view: { userIds: [1], teamIds: [] },
    edit: { userIds: [], teamIds: [] },
  }}
/>
```

## API response mapping

The component expects normalized frontend data, not a raw backend payload.

Recommended backend response:

```json
{
  "users": [
    {
      "id": 1,
      "email": "jose@main-sequence.io",
      "name": "Jose",
      "role_label": "Org Admin"
    }
  ],
  "teams": [
    {
      "id": 10,
      "name": "Engineering Fixed Income",
      "member_count": 2
    }
  ],
  "assignments": {
    "view": {
      "user_ids": [1],
      "team_ids": [10]
    },
    "edit": {
      "user_ids": [1],
      "team_ids": []
    }
  }
}
```

Frontend adapter:

```ts
const users = payload.users.map((user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  roleLabel: user.role_label,
}));

const teams = payload.teams.map((team) => ({
  id: team.id,
  name: team.name,
  memberCount: team.member_count,
}));

const value = Object.fromEntries(
  Object.entries(payload.assignments).map(([scopeId, assignment]) => [
    scopeId,
    {
      userIds: assignment.user_ids,
      teamIds: assignment.team_ids,
    },
  ]),
);
```

## Current example

The current mock integration lives in:

- `src/features/access/AccessPage.tsx`

## Public docs

When the app is running, this documentation is available at:

- `/docs`
- `/docs/rbac-assignment-matrix`
