# Configuration

## Purpose

Command Center keeps user-editable runtime configuration outside `src/` so branding and backend integration details are separated from application functionality.

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
INCLUDE_AUI=true
INCLUDE_WORKSPACES=true
```

## Current schema

```yaml
app:
  name: Main Sequence Command Center
  short_name: Main Sequence
  notifications_refresh_interval_ms: 300000

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

auth:
  base_url: http://127.0.0.1:8000
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
      permissions: permissions
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
        permissions: permissions
        groups: groups
        date_joined: date_joined
        is_active: is_active
        last_login: last_login
        mfa_enabled: mfa_enabled
        organization_teams: organization_teams
      role_groups:
        admin: Organization Admin
        user:

access_rbac:
  users:
    list_url: /user/api/user/
  groups:
    list_url: /user/api/user/get_rbac_groups/

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

- `app.name`: full product name used by the app
- `app.short_name`: shorter product name for compact UI copy
- `app.notifications_refresh_interval_ms`: notification polling interval in milliseconds. Defaults to `300000` (5 minutes) when the key is omitted.
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
- `auth.base_url`: base URL used to resolve relative JWT auth endpoints
- `auth.identifier_label`: label shown on the login form for the primary credential field
- `auth.identifier_placeholder`: placeholder shown on that field
- `auth.jwt.token_url`: login endpoint that returns an access token
- `auth.jwt.refresh_url`: refresh endpoint that returns a new access token
- `auth.jwt.request_fields.*`: request body field names for identifier, password, and refresh token
- `auth.jwt.response_fields.*`: response field paths for access token, refresh token, and token type
- `auth.jwt.claim_mapping.*`: token-claim or response-field paths used to build the frontend session and RBAC permissions
- `auth.jwt.user_details.url`: authenticated endpoint fetched immediately after successful login and refresh
- `auth.jwt.user_details.response_mapping.*`: field paths used to map the user-details payload into the frontend session user
- `auth.jwt.user_details.role_groups.*`: comma-separated group names that map backend groups into the built-in `admin` / `user` access classes
- `access_rbac.users.list_url`: authenticated endpoint used by the Access & RBAC app user inspector to search the user directory
- `access_rbac.groups.list_url`: authenticated endpoint used by the Access & RBAC policy studio to load assignable RBAC groups
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
- resolves logo filenames against `config/branding/`
- swaps between light and dark logos based on the active theme
- uses the configured mark asset in the compact sidebar/login mark
- loads and syncs shell-level user preferences through `preferences.url` when it is configured
- falls back to local browser persistence for language and favorites when `preferences.url` is blank or omitted
- loads and saves workspaces through the configured workspace endpoints when both workspace URLs are configured
- falls back to browser-local workspace persistence when either workspace URL is blank, `null`, or `None`
- resolves JWT login and refresh endpoints from the configured auth block
- fetches configured user details after JWT login succeeds
- revalidates persisted JWT sessions against the configured user-details endpoint before granting access
- maps configured token claims and user-details fields into the frontend session user
- derives built-in shell access classes from configured backend groups
- queries the configured Access & RBAC users endpoint when an admin searches the user directory
- queries the configured Access & RBAC groups endpoint when an admin assigns RBAC groups to shell policies
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
  - `GET`: return the current workspace list
  - `POST`: create one workspace document
- `workspaces.detail_url`
  - `PUT`: replace one workspace document
  - `DELETE`: remove one workspace document

Expected workspace payload shape:

```json
{
  "id": "custom-dashboard-123",
  "title": "Rates Desk",
  "description": "Shared workspace for rates monitoring",
  "labels": ["rates", "monitoring"],
  "category": "Custom",
  "source": "user",
  "grid": {
    "columns": 96,
    "rowHeight": 18,
    "gap": 2
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
- The current adapter expects stable workspace ids in the request/response document shape so draft save operations can map cleanly back onto the selected workspace route.
- Blank, `null`, and `None` values are all treated as "not configured" for workspace endpoints.

## Notes

- Keep logo filenames relative to `config/branding/`.
- The current parser is intentionally small and designed for simple nested key/value configuration.
- JWT field mappings support dotted paths such as `user.email` or `data.tokens.access`.
- Group role mappings use comma-separated strings because the runtime config parser is intentionally simple.
- `VITE_BYPASS_AUTH=true` bypasses backend auth locally and re-enables the mock role picker.
- `INCLUDE_AUI=true` keeps the detachable `assistant-ui` chat integration mounted; set it to `false` to remove the runtime chat surface without uninstalling the dependency.
- `INCLUDE_WORKSPACES=true` keeps the `Workspaces` app registered; set it to `false` to remove the `workspace-studio` app from the runtime registry and shell navigation.
- Relative auth endpoint paths are resolved against `auth.base_url`. Absolute URLs are used as-is.
- If the configured asset is missing, the app falls back to the default bundled branding asset names.
