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

Runtime data mode is selected with:

- `VITE_USE_MOCK_DATA=true` for local mock adapters
- `VITE_USE_MOCK_DATA=false` for the live REST/WebSocket adapters
- `VITE_BYPASS_AUTH=true` to bypass backend auth locally and use the built-in role picker
- `VITE_API_BASE_URL` and `VITE_WS_URL` for live transport endpoints

## Data integration model

The app already assumes two classes of backend integration:

- REST-style request/response data
- live streaming updates

The current recommendation is:

- REST for snapshots, lookup data, search, historical series, and mutations
- WebSocket or stream transport for prices, order updates, alerts, and presence

## Query layer

`TanStack Query` is the integration boundary for async data. When moving to production data sources:

1. Keep widgets importing from `src/data/api.ts`, not directly from mock files.
2. Keep query keys stable.
3. Preserve the UI-facing data shapes where possible.
4. Move transport details behind adapter functions rather than pushing them into widgets.

## Authentication model

By default, the login surface uses a JWT-based auth flow: it posts credentials to the configured token endpoint, then fetches user details and stores the resolved session locally.

For local development only, `VITE_BYPASS_AUTH=true` switches the login surface back to a mock access-class picker that bypasses backend auth entirely.

The UI integration boundary stays the same:

- session state lives in the auth store
- protected routes require a valid session
- page- and widget-level access use permission metadata
- live REST requests attach the active bearer token automatically
- 401 live REST responses attempt a single refresh before failing

## JWT configuration contract

JWT mode is configured in `config/command-center.yaml`:

```yaml
auth:
  base_url: http://127.0.0.1:8000
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
      permissions: permissions
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
      role_groups:
        admin: Organization Admin
        user:
```

Important behavior:

- `token_url` and `refresh_url` accept relative or absolute URLs
- `user_details.url` is fetched with the bearer access token immediately after login and refresh
- stored JWT sessions are re-authorized on app boot only after `user_details.url` succeeds
- request field names are configurable so you can send `username` instead of `email` if needed
- response field paths support dotted lookups such as `data.access`
- RBAC fields can be read from either the token payload, the token response payload, or the user-details payload
- built-in shell access classes are derived from backend RBAC group mappings; with the default config, membership in `Organization Admin` maps to `admin`
- if `permissions` is missing, the frontend falls back to the built-in `admin` / `user` permission matrix

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
