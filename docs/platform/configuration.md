# Configuration

## Purpose

Command Center keeps user-editable runtime configuration outside `src/` so branding and backend integration details are separated from application functionality.

Organization authorization policy does not belong in this file. The YAML maps where to read
backend-provided auth fields, but it must not define which users are `ORG_ADMIN` or platform-admin.

The current configuration entrypoint is:

```text
config/command-center.yaml
```

Brand assets live in:

```text
config/branding/
```

Auth bypass for local development is controlled separately through Vite env:

```text
VITE_BYPASS_AUTH=true
```

Optional UI feature flags are also controlled through env:

```text
VITE_ASSISTANT_UI_ENDPOINT=/__assistant__
VITE_ASSISTANT_UI_PROXY_TARGET=http://192.168.1.253:8787
VITE_INCLUDE_AUI=true
VITE_INCLUDE_WORKSPACES=true
```

## Current schema

```yaml
assistant_ui:
  protocol: ui-message-stream

app:
  name: Main Sequence Command Center
  short_name: Main Sequence
  notifications_refresh_interval_ms: 300000
  cache:
    app_component_openapi_document_ttl_ms: 300000
    app_component_safe_response_ttl_ms: 30000

branding:
  logo_lightmode: logo_lightmode.png
  logo_darkmode: logo_darkmode.png
  logo_mark: logo_mark.png
  logo_alt: Main Sequence
  monogram: MS

preferences:
  url: /api/v1/command_center/preferences/
  favorites_create_url: /api/v1/command_center/favorites/
  favorites_reorder_url: /api/v1/command_center/favorites/reorder/
  favorites_delete_url: /api/v1/command_center/favorites/{kind}/{target_key}/

workspaces:
  list_url:
  detail_url:

widget_types:
  list_url: /api/v1/command_center/widget-types/
  detail_url: /api/v1/command_center/widget-types/{id}/
  sync_url: /api/v1/command_center/widget-types/sync/
  organization_configurations_list_url: /api/v1/command_center/org-widget-type-configurations/
  organization_configurations_detail_url: /api/v1/command_center/org-widget-type-configurations/{id}/

auth:
  identifier_label: Email
  identifier_placeholder: admin@example.com
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
      date_joined: date_joined
      is_active: is_active
      last_login: last_login
      mfa_enabled: mfa_enabled
      organization_teams: organization_teams
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
        date_joined: date_joined
        is_active: is_active
        last_login: last_login
        mfa_enabled: mfa_enabled
        organization_teams: organization_teams

access_rbac:
  users:
    list_url: /user/api/user/
  groups:
    list_url: /user/api/user/get_rbac_groups/

command_center_access:
  access_policies:
    list_url: /api/v1/command_center/access-policies/
    detail_url: /api/v1/command_center/access-policies/{id}/
  users:
    shell_access_url: /api/v1/command_center/users/{user_id}/shell-access/
    shell_access_preview_url: /api/v1/command_center/users/{user_id}/shell-access/preview/

notifications:
  list_url: /user/api/notifications/
  detail_url: /user/api/notifications/{id}/
  mark_read_url: /user/api/notifications/{id}/mark-read/
  dismiss_url: /user/api/notifications/{id}/dismiss/
  mark_all_read_url: /user/api/notifications/mark-all-read/
  dismiss_all_url: /user/api/notifications/dismiss-all/
  type: UR
```

## Fields

- `assistant_ui.endpoint`: optional YAML fallback for the assistant server root. In live chat mode (`VITE_USE_MOCK_DATA=false`), the detachable assistant rail/page resolves the server root from `VITE_ASSISTANT_UI_ENDPOINT` first, then this YAML field if the env var is unset. Live chat posts to `/api/chat` under that root, and related helpers call `/api/chat/history`, `/api/chat/session-tools`, and `/api/chat/get_available_models` under the same root.
- `VITE_ASSISTANT_UI_PROXY_TARGET`: optional Vite-only dev proxy target for the assistant backend. Use this with `VITE_ASSISTANT_UI_ENDPOINT=/__assistant__` when the browser cannot reach the assistant LAN host directly.
- `assistant_ui.protocol`: assistant-ui transport protocol expected from the backend. Supported values are `ui-message-stream` and `data-stream`. Defaults to `ui-message-stream`.
- `app.name`: full product name used by the app
- `app.short_name`: shorter product name for compact UI copy
- `app.notifications_refresh_interval_ms`: notification polling interval in milliseconds. Defaults to `300000` (5 minutes) when the key is omitted.
- `app.cache.app_component_openapi_document_ttl_ms`: in-memory TTL for shared AppComponent OpenAPI discovery caching. Defaults to `300000` (5 minutes).
- `app.cache.app_component_safe_response_ttl_ms`: in-memory TTL for shared AppComponent safe-response caching. Defaults to `30000` (30 seconds).
- `branding.logo_lightmode`: logo file to use on light themes
- `branding.logo_darkmode`: logo file to use on dark themes
- `branding.logo_mark`: compact mark used in the sidebar and other small brand surfaces
- `branding.logo_alt`: alt text for the brand image
- `branding.monogram`: short label used by the compact brand mark
- `preferences.url`: optional authenticated `GET/PUT` snapshot endpoint used to load and save shell-level user preferences such as language and favorites. Leave blank to keep the existing browser-local persistence behavior.
- `preferences.favorites_create_url`: optional authenticated `POST` endpoint for creating one favorite entry.
- `preferences.favorites_reorder_url`: optional authenticated `POST` endpoint for reordering favorites.
- `preferences.favorites_delete_url`: optional authenticated `DELETE` endpoint for removing one favorite entry. The current backend contract uses `{kind}` and `{target_key}` path placeholders.
- `workspaces.list_url`: optional authenticated list/create endpoint for workspace documents. When this and `workspaces.detail_url` are configured, Workspaces stops using browser-local storage.
- `workspaces.detail_url`: optional authenticated detail/update/delete endpoint for one workspace document. The frontend supports `{id}` or `:id` placeholders and also falls back to appending the workspace id if the placeholder is omitted.
- `widget_types.sync_url`: authenticated endpoint used to sync the frontend widget registry into the backend widget-type catalog during login/session bootstrap.
- `auth.identifier_label`: label shown on the login form for the primary credential field
- `auth.identifier_placeholder`: placeholder shown on that field
- `auth.jwt.token_url`: login endpoint that returns an access token
- `auth.jwt.refresh_url`: refresh endpoint that returns a new access token
- `auth.jwt.request_fields.*`: request body field names for identifier, password, and refresh token
- `auth.jwt.response_fields.*`: response field paths for access token, refresh token, and token type
- `auth.jwt.claim_mapping.*`: token-claim or response-field paths used to build the frontend session and RBAC permissions
- `auth.jwt.user_details.url`: authenticated endpoint fetched immediately after successful login and refresh
- `auth.jwt.user_details.response_mapping.*`: field paths used to map the user-details payload into the frontend session user
- `auth.jwt.claim_mapping.platform_permissions` and `auth.jwt.user_details.response_mapping.platform_permissions`: field paths used to resolve platform-only permissions such as `platform_admin:access`
- `auth.jwt.claim_mapping.is_platform_admin` and `auth.jwt.user_details.response_mapping.is_platform_admin`: optional boolean field paths used to mark a session as platform-admin
- `access_rbac.users.list_url`: authenticated endpoint used by the Access & RBAC app user inspector to search the user directory
- `command_center_access.access_policies.list_url`: authenticated list/create endpoint for visible Command Center shell policies
- `command_center_access.access_policies.detail_url`: authenticated detail/update/delete endpoint for one Command Center shell policy; the frontend replaces `{id}` with the integer policy id
- `command_center_access.users.shell_access_url`: authenticated read/update endpoint for one user's Command Center shell assignments; the frontend replaces `{user_id}` with the inspected user id
- `command_center_access.users.shell_access_preview_url`: authenticated preview endpoint that resolves a draft shell-access payload without saving it
- `notifications.list_url`: endpoint used to fetch the notification feed
- `notifications.detail_url`: endpoint used to fetch a single notification body
- `notifications.mark_read_url`: endpoint used to mark one notification as read
- `notifications.dismiss_url`: endpoint used to dismiss one notification
- `notifications.mark_all_read_url`: endpoint used to mark the full feed as read
- `notifications.dismiss_all_url`: endpoint used to dismiss the full feed
- `notifications.type`: backend notification type code forwarded with each source definition

Additional optional user attributes supported by both claim mapping and user-details mapping:

- `date_joined`
- `is_active`
- `last_login`
- `mfa_enabled`
- `organization_teams`

## Behavior

The application:

- loads `config/command-center.yaml`
- exposes the configured `assistant_ui.*` values through the parsed runtime config
- uses `assistant_ui.endpoint` as the live assistant stream endpoint when `VITE_USE_MOCK_DATA=false`
- uses `assistant_ui.protocol` to choose the assistant-ui stream decoder in live mode
- resolves logo filenames against `config/branding/`
- swaps between light and dark logos based on the active theme
- uses the configured mark asset in the compact sidebar/login mark
- loads and syncs shell-level user preferences through `preferences.url` when it is configured
- falls back to local browser persistence for language and favorites when `preferences.url` is blank or omitted
- loads and saves workspaces through the configured workspace endpoints when both workspace URLs are configured
- falls back to browser-local workspace persistence when either workspace URL is blank, `null`, or `None`
- uses `app.cache.*` TTLs for shared AppComponent OpenAPI discovery and short-lived safe-response caching
- syncs the frontend widget registry through `widget_types.sync_url` when that endpoint is configured
- resolves JWT login and refresh endpoints from the configured auth block
- fetches configured user details after JWT login succeeds
- revalidates persisted JWT sessions against the configured user-details endpoint before granting access
- maps configured token claims and user-details fields into the frontend session user
- derives organization-admin and platform-admin access from backend-owned claims or user-details fields
- resolves shell visibility from the authenticated user's shell-access `effective_permissions`
- queries the configured Access & RBAC users endpoint when an admin searches the user directory
- loads shell policy definitions through `command_center_access.access_policies.*`
- loads, previews, and saves user shell-access assignments through `command_center_access.users.*`
- expects the fixed `light-user`, `dev-user`, and `org-admin-user` shell policies to be created by the backend
- hides the backend-enforced `platform-admin` policy from the organization-admin policy UI
- refreshes the notifications feed using `app.notifications_refresh_interval_ms`
- uses user initials for account surfaces when no user-specific avatar is provided

## Preferences endpoint contract

The preferences config block supports one snapshot endpoint plus explicit favorite mutation endpoints.

Configured endpoints:

- `preferences.url`
  - `GET`: return the current snapshot
  - `PUT`: replace the current snapshot and return the saved normalized snapshot
- `preferences.favorites_create_url`
  - `POST`: create one favorite entry
- `preferences.favorites_reorder_url`
  - `POST`: reorder favorites
- `preferences.favorites_delete_url`
  - `DELETE`: remove one favorite entry

Expected payload shape:

```json
{
  "language": "en",
  "favoriteSurfaceIds": ["access-rbac.overview"],
  "favoriteWorkspaceIds": ["workspace-studio::workspace::abc123"]
}
```

Notes:

- The shell still keeps transient UI state such as sidebar expansion, kiosk mode, active app panel, and command input in local memory.
- If `preferences.url` is configured, the frontend stops using `localStorage` for language and shell favorites.
- If `preferences.url` is not configured, the frontend continues using the existing local browser persistence path with no backend dependency.
- The current frontend runtime uses the snapshot endpoint directly. The explicit favorite mutation URLs are documented in config so the backend contract is visible and can be adopted incrementally.

## Workspaces endpoint contract

The workspace config block supports a minimal DRF-style list/detail contract.

Configured endpoints:

- `workspaces.list_url`
  - `GET`: return lightweight workspace summaries
  - `POST`: create one workspace document
- `workspaces.detail_url`
  - `GET`: return one full workspace document
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

Notes:

- The studio still keeps draft/save/reset semantics on the frontend; backend mode only swaps the persistence target.
- The list endpoint is intentionally summary-only; the frontend no longer expects nested widget,
  layout, or binding data from `GET workspaces.list_url`.
- The current adapter expects stable workspace ids in the detail request/response document shape so
  draft save operations can map cleanly back onto the selected workspace route.
- Blank, `null`, and `None` values are all treated as "not configured" for workspace endpoints.

## Notes

- Keep logo filenames relative to `config/branding/`.
- The current parser is intentionally small and designed for simple nested key/value configuration.
- JWT field mappings support dotted paths such as `user.email` or `data.tokens.access`.
- Group role mappings use comma-separated strings because the runtime config parser is intentionally simple.
- `VITE_BYPASS_AUTH=true` bypasses backend auth locally and re-enables the mock role picker.
- `VITE_INCLUDE_AUI=true` keeps the detachable `assistant-ui` chat integration mounted; set it to `false` to remove the runtime chat surface without uninstalling the dependency.
- `VITE_INCLUDE_WORKSPACES=true` keeps the `Workspaces` app registered; set it to `false` to remove the `workspace-studio` app from the runtime registry and shell navigation.
- Relative backend endpoint paths are resolved against `VITE_API_BASE_URL`. Absolute URLs are used as-is.
- If the configured asset is missing, the app falls back to the default bundled branding asset names.
