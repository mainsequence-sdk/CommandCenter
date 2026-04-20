# Backend and Auth Integration

## Current state

The repository currently ships with mock data and a configurable JWT auth layer so the shell, registry, and widgets can be exercised locally or wired to a real backend without changing the shell code.

Relevant files:

- `src/data/api.ts`
- `src/data/terminal-socket.ts`
- `src/data/demo-api.ts`
- `src/data/mock/terminal-socket.ts`
- `src/data/live/rest-api.ts`
- `src/data/live/terminal-socket.ts`
- `src/auth/mock-auth.ts`
- `src/auth/jwt-auth.ts`
- `src/auth/auth-store.ts`
- `src/auth/permissions.ts`
- `src/config/command-center.ts`
- `src/preferences/api.ts`
- `src/preferences/CommandCenterPreferencesProvider.tsx`
- `src/features/dashboards/workspace-api.ts`
- `src/features/dashboards/workspace-persistence.ts`

Runtime data mode is selected with:

- `VITE_USE_MOCK_DATA=true` for local mock adapters
- `VITE_USE_MOCK_DATA=false` for the live REST/WebSocket adapters and to remove the built-in `Demo` app from the shell registry
- `VITE_BYPASS_AUTH=true` to bypass backend auth locally and use the built-in role picker
- `VITE_API_BASE_URL` and `VITE_WS_URL` for live transport endpoints
- `VITE_INCLUDE_WEBSOCKETS=true|false` to enable or disable websocket connection startup and streaming subscriptions without changing REST mode
- `VITE_INCLUDE_AUI=true|false` to enable or disable the detachable `assistant-ui` shell integration
- `VITE_INCLUDE_WORKSPACES=true|false` to enable or disable the `Workspaces` app at the registry level

## Data integration model

The app already assumes two classes of backend integration:

- REST-style request/response data
- live streaming updates

The current recommendation is:

- REST for snapshots, lookup data, search, historical series, and mutations
- WebSocket or stream transport for prices, order updates, alerts, and presence

The shell now also supports an optional authenticated REST endpoint for user preferences such as:

- language
- favorite app surfaces
- favorite workspace entries

Workspaces can also switch from browser-local persistence to authenticated backend persistence
through the `workspaces.*` config block.

## Query layer

`TanStack Query` is the integration boundary for async data. When moving to production data sources:

1. Keep widgets importing from `src/data/api.ts`, not directly from mock files.
2. Keep query keys stable.
3. Preserve the UI-facing data shapes where possible.
4. Move transport details behind adapter functions rather than pushing them into widgets.

## Authentication model

By default, the login surface uses a two-step JWT-based auth flow: it posts credentials to the
configured token endpoint, fetches user details for identity, then fetches the current user's
Command Center shell-access record and stores the resolved session locally.

For local development only, `VITE_BYPASS_AUTH=true` switches the login surface back to a mock access-class picker that bypasses backend auth entirely.

The UI integration boundary stays the same:

- session state lives in the auth store
- protected routes require a valid session
- page- and widget-level access use permission metadata
- live REST requests attach the active bearer token automatically
- 401 live REST responses attempt a single refresh before failing

Important distinction:

- JWT/session storage is auth/session state, not product preference state
- shell preferences use a separate optional backend integration and are safe to leave browser-local in development
- workspace persistence is also a separate optional integration and can stay browser-local until the backend endpoints are ready
- organization-admin navigation and platform-only Admin Settings are separate access concerns
- hiding the Admin Settings modal in the frontend is not the security boundary; the backend must
  enforce platform-admin authorization on every sensitive endpoint

## JWT configuration contract

JWT mode is configured in `config/command-center.yaml`:

```yaml
auth:
  identifier_label: Email
  identifier_placeholder: name@example.com
  jwt:
    token_url: /auth/jwt-token/token/
    refresh_url: /auth/jwt-token/token/refresh/
    request_fields:
      identifier: email
      password: password
      refresh: refresh
    response_fields:
      access_token: access
      refresh_token: refresh
      token_type: token_type
    claim_mapping:
      user_id: sub
      name: name
      email: email
      team: team
      role: role
      organization_role: organization_role
      permissions: permissions
      platform_permissions: platform_permissions
      is_platform_admin: is_platform_admin
    user_details:
      url: /user/api/user/get_user_details/
      response_mapping:
        user_id: id
        name: name
        email: email
        team: team
        role: role
        organization_role: organization_role
        permissions: permissions
        platform_permissions: platform_permissions
        is_platform_admin: is_platform_admin
```

Important behavior:

- `token_url` and `refresh_url` accept relative or absolute URLs
- `user_details.url` is fetched with the bearer access token immediately after login and refresh
- `/api/v1/command_center/users/<user_id>/shell-access/` is then fetched and its
  `effective_permissions` become the shell source of truth
- stored JWT sessions are rehydrated against shell-access on app boot
- request field names are configurable so you can send `username` instead of `email` if needed
- response field paths support dotted lookups such as `data.access`
- RBAC fields can be read from either the token payload, the token response payload, or the user-details payload
- organization-admin and platform-admin access are now backend-owned values
- the frontend config maps the user-details identity fields and the platform-admin fields
- the frontend no longer treats `config/command-center.yaml` as the source of truth for organization policy
- auth groups can still be displayed for reference, but they do not unlock org-admin shell access
- the shell now resolves org-admin access from `effective_permissions` returned by the dedicated
  shell-access endpoint

## Command Center shell-access contract

Identity and Command Center shell visibility are now separate contracts.

- `/user/api/user/get_user_details/` provides identity/profile data for the signed-in user
- `/api/v1/command_center/access-policies/` owns reusable shell policy definitions
- `/api/v1/command_center/users/<user_id>/shell-access/` owns per-user shell policy assignments
  plus direct permission grants and denies

Configured endpoints live in `config/command-center.yaml` under `command_center_access`.

Policy endpoints:

- `GET /api/v1/command_center/access-policies/`
- `POST /api/v1/command_center/access-policies/`
- `GET /api/v1/command_center/access-policies/<id>/`
- `PATCH /api/v1/command_center/access-policies/<id>/`
- `DELETE /api/v1/command_center/access-policies/<id>/`

Policy response shape:

```json
{
  "id": 7,
  "slugified_name": "research-analyst",
  "label": "Research Analyst",
  "description": "Workspaces and Main Sequence Markets access without admin tools.",
  "permissions": [
    "workspaces:view",
    "main_sequence_markets:view",
    "widget.catalog:view"
  ],
  "is_system": false,
  "is_editable": true
}
```

Important behavior:

- the frontend uses `slugified_name` as the stable policy key
- policy detail routes still use the integer `id`
- the org-admin-facing UI hides the backend-enforced `platform-admin` policy
- the built-in `light-user`, `dev-user`, and `org-admin-user` policies are expected to be created
  by the backend and are treated as read-only in the frontend

Shell-access endpoints:

- `GET /api/v1/command_center/users/<user_id>/shell-access/`
- `PATCH /api/v1/command_center/users/<user_id>/shell-access/`
- `POST /api/v1/command_center/users/<user_id>/shell-access/preview/`

Shell-access response shape:

```json
{
  "user_id": 42,
  "policy_ids": ["research-analyst"],
  "grant_permissions": ["orders:read"],
  "deny_permissions": [],
  "derived": {
    "is_org_admin": true,
    "groups": [
      {
        "id": 3,
        "name": "Organization Admin",
        "normalized_name": "org_admin"
      }
    ]
  },
  "effective_permissions": [
    "workspaces:view",
    "main_sequence_markets:view",
    "widget.catalog:view",
    "orders:read",
    "org_admin:view"
  ]
}
```

Write shapes:

```json
{
  "slugified_name": "research-analyst",
  "label": "Research Analyst",
  "description": "Workspaces and Main Sequence Markets access without admin tools.",
  "permissions": [
    "workspaces:view",
    "main_sequence_markets:view",
    "widget.catalog:view"
  ]
}
```

## Widget type registry sync contract

Backend widget-type publication is now an explicit admin action. It is no longer tied to normal
sign-in or app bootstrap.

The frontend publishes one versioned widget manifest to the configured `widget_types.sync_url`
endpoint. That manifest contains:

- a global `registryVersion`
- a global manifest `checksum`
- one row per widget type

Each synced widget row now includes:

- catalog identity such as `widgetId`, `title`, `description`, `kind`, `category`, and `source`
- a per-widget `widgetVersion`
- a structured configuration contract
- a structured runtime contract
- a structured IO contract
- capability metadata
- agent-facing authoring hints
- type-level examples

Important backend expectations:

- treat the synced row as widget-type metadata, not widget-instance state
- do not expect instance-specific binding choices, compiled forms, or runtime state in this manifest
- preserve `widgetVersion` so backend tooling can detect per-widget behavioral changes without
  diffing the entire manifest
- use `registryVersion` for manifest-schema compatibility and `checksum` for idempotent sync/no-op
  handling
- validate and store the richer `schema_payload` and `io` payloads as structured JSON, not as
  opaque strings

The frontend now validates the manifest before publish and blocks admin publication when required
contract sections are missing. Backend validation should still remain strict, because the registry
is now intended to power agentic tooling as well as human catalog browsing.

```json
{
  "policy_ids": ["research-analyst", "ops-reviewer"],
  "grant_permissions": ["orders:read"],
  "deny_permissions": ["orders:submit"]
}
```

Important behavior:

- login and refresh now resolve shell access from the dedicated shell-access endpoint
- User Inspector writes only to the dedicated shell-access endpoint
- it does not patch `/user/api/user/<id>/`
- apps, surfaces, widgets, and utility actions remain derived from `effective_permissions`
- hidden or system policy ids returned by the backend are preserved in the write payload even when
  they are not viewable in the organization-admin UI

## Preferences endpoint contract

In addition to JWT auth, the shell can optionally hydrate durable user preferences from the `preferences.*` block in `config/command-center.yaml`.

Configured endpoints:

- `preferences.url`
  - `GET`: load the current preference snapshot for the authenticated user
  - `PUT`: replace the snapshot and return the saved normalized snapshot
- `preferences.favorites_create_url`
  - `POST`: create one favorite entry
- `preferences.favorites_reorder_url`
  - `POST`: reorder favorites of a given kind
- `preferences.favorites_delete_url`
  - `DELETE`: remove one favorite entry, typically using `{kind}` and `{target_key}` path placeholders

Expected payload shape:

```json
{
  "language": "en",
  "favoriteSurfaceIds": ["access-rbac.overview"],
  "favoriteWorkspaceIds": ["workspace-studio::workspace::abc123"]
}
```

Important behavior:

- when `preferences.url` is configured, the frontend loads preferences after auth is available
- language and shell favorites are then synchronized through that endpoint
- transient shell UI state such as kiosk mode, sidebar visibility, app-panel visibility, and command input remain local-only
- when `preferences.url` is blank or omitted, the app keeps the existing `localStorage` behavior for language and favorites
- the dedicated favorite mutation endpoints are now part of the runtime config contract even though the current frontend still centers around the snapshot endpoint

## Workspaces endpoint contract

In addition to JWT auth and shell preferences, the Workspaces app can optionally hydrate and persist
workspace documents through the `workspaces.*` block in `config/command-center.yaml`.

Configured endpoints:

- `workspaces.list_url`
  - `GET`: load lightweight workspace summaries for the authenticated user
  - `POST`: create one workspace document
- `workspaces.detail_url`
  - `GET`: load one full workspace document
  - `PUT`: replace one workspace document
  - `DELETE`: remove one workspace document

Expected list `GET` payload shape:

```json
{
  "results": [
    {
      "id": "custom-dashboard-123",
      "title": "Rates Desk",
      "description": "Shared workspace for rates monitoring",
      "labels": ["rates", "monitoring"],
      "source": "user",
      "updatedAt": "2026-04-03T12:00:00Z"
    }
  ]
}
```

Expected detail `GET` / `POST` / `PUT` payload shape:

```json
{
  "id": "custom-dashboard-123",
  "title": "Rates Desk",
  "description": "Shared workspace for rates monitoring",
  "labels": ["rates", "monitoring"],
  "category": "Custom",
  "source": "user",
  "grid": {
    "columns": 24,
    "rowHeight": 30,
    "gap": 8
  },
  "controls": {
    "enabled": true,
    "timeRange": {
      "enabled": true,
      "defaultRange": "24h",
      "options": ["15m", "1h", "6h", "24h", "7d", "30d", "90d"]
    },
    "refresh": {
      "enabled": true,
      "defaultIntervalMs": 60000,
      "intervals": [null, 10000, 15000, 30000, 60000]
    },
    "actions": {
      "enabled": true,
      "share": false,
      "view": true
    }
  },
  "widgets": []
}
```

Important behavior:

- when both workspace URLs are configured, the frontend stops using `localStorage` for workspace documents
- the list endpoint is summary-only; full workspace detail is fetched on demand
- the editor keeps the same draft/save/reset UX and only swaps the persistence target underneath
- blank, `null`, or `None` workspace URLs keep the browser-local development fallback active

## Authorization model

Permission sets are defined in `src/auth/permissions.ts`. The current built-in model only distinguishes `admin` and `user`, and demonstrates how the UI can enforce access rules for:

- dashboards
- widget catalog access
- theme studio access
- RBAC inspector access
- market data, portfolio, news, and orders

The backend must still enforce the same rules server-side.

## Recommended production mapping

When wiring the shell to your backend:

- point `auth.jwt.token_url` and `auth.jwt.refresh_url` at your backend
- point `auth.jwt.user_details.url` at an authenticated user profile endpoint
- optionally point the `preferences.*` endpoints at your per-user preference and favorite APIs if you want server-side persistence for language and favorites
- optionally point the `workspaces.*` endpoints at your workspace list/detail APIs if you want server-side persistence for workspace documents
- map the credential field names your backend expects
- map RBAC group names into shell access classes if your backend model is group-based
- hydrate permissions from the backend token claims, token response payload, or user-details payload
- treat frontend permissions as UX hints plus navigation rules
- keep server authorization authoritative
- centralize backend adapters under `src/data/`
- keep `src/data/api.ts` and `src/data/terminal-socket.ts` as the only app-facing entrypoints

For local-only bypass auth:

- set `VITE_BYPASS_AUTH=true`
- choose a built-in role in the login screen
- remember that this bypasses backend authorization entirely and should not be enabled outside development

## Optional vendor integrations

Vendor-specific charting or grid libraries should stay in optional extensions even after backend integration is complete. The backend contract should not depend on a specific chart or table package.
