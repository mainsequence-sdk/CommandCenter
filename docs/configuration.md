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

## Current schema

```yaml
app:
  name: Main Sequence Command Center
  short_name: Main Sequence

branding:
  logo_lightmode: logo_lightmode.png
  logo_darkmode: logo_darkmode.png
  logo_mark: logo_mark.png
  logo_alt: Main Sequence
  monogram: MS

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
        trader:
        analyst:
        viewer:
```

## Fields

- `app.name`: full product name used by the app
- `app.short_name`: shorter product name for compact UI copy
- `branding.logo_lightmode`: logo file to use on light themes
- `branding.logo_darkmode`: logo file to use on dark themes
- `branding.logo_mark`: compact mark used in the sidebar and other small brand surfaces
- `branding.logo_alt`: alt text for the brand image
- `branding.monogram`: short label used by the compact brand mark
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
- `auth.jwt.user_details.role_groups.*`: comma-separated group names that map backend groups into built-in shell roles

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
- resolves JWT login and refresh endpoints from the configured auth block
- fetches configured user details after JWT login succeeds
- revalidates persisted JWT sessions against the configured user-details endpoint before granting access
- maps configured token claims and user-details fields into the frontend session user
- derives built-in shell roles from configured backend groups
- uses user initials for account surfaces when no user-specific avatar is provided

## Notes

- Keep logo filenames relative to `config/branding/`.
- The current parser is intentionally small and designed for simple nested key/value configuration.
- JWT field mappings support dotted paths such as `user.email` or `data.tokens.access`.
- Group role mappings use comma-separated strings because the runtime config parser is intentionally simple.
- `VITE_BYPASS_AUTH=true` bypasses backend auth locally and re-enables the mock role picker.
- Relative auth endpoint paths are resolved against `auth.base_url`. Absolute URLs are used as-is.
- If the configured asset is missing, the app falls back to the default bundled branding asset names.
