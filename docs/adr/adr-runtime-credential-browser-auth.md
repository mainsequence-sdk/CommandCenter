# ADR: Runtime Credential Browser Auth

- Status: Accepted
- Date: 2026-04-23
- Related:
  - [ADR: Live Workspace Agent Snapshot Archive](./adr-live-workspace-agent-snapshot-archive.md)
  - [Auth Backend Contract](../auth/backend-and-auth.md)

## Context

The Command Center shell already has a canonical interactive authentication flow:

- the user signs in through the configured JWT token endpoint
- the backend returns an access token and refresh token
- the frontend persists that session under `command-center.jwt-auth`
- the frontend refreshes the access token before expiry
- normal browser requests use `Authorization: Bearer <access token>`

Workspace snapshot automation runs differently. A machine-controlled browser can open the SPA,
write browser storage, navigate to the workspace snapshot route, and read the generated archive.
That machine flow does not need an interactive login form, MFA, refresh-token rotation, or
browser logout semantics.

The backend also supports a scoped runtime credential called `runtime_credential`. This credential
is supplied to automation as `MAINSEQUENCE_ACCESS_TOKEN` and is sent as:

```http
Authorization: Bearer <runtime access JWT>
```

Although transport still uses a bearer JWT, the credential represents a scoped machine/runtime
identity, not a normal interactive JWT+refresh browser session.

## Decision

The frontend will keep the existing JWT auth flow as the canonical user-login path and add a
second stored auth mode for machine-run browser automation.

Both modes continue to use the same request transport:

```http
Authorization: Bearer <token>
```

The distinction lives in the restored session metadata.

### Canonical Interactive Mode

Stored entries with no explicit `authMode`, or with `authMode: "jwt"`, use the existing behavior:

- access token plus optional refresh token
- refresh scheduling
- refresh retry on `401`
- authenticated logout request
- interactive login/MFA lifecycle

### Runtime Credential Mode

Stored entries with `authMode: "runtime_credential"` use access-token-only behavior:

- read the runtime access JWT from `tokens.accessToken` or `MAINSEQUENCE_ACCESS_TOKEN`
- send it as `Authorization: Bearer <runtime access JWT>`
- do not require or persist a refresh token
- do not schedule refresh
- do not treat `401` as refreshable
- do not call the interactive logout endpoint
- clear local browser state on logout

This mode is designed specifically for machine-run browsers that bootstrap the SPA by injecting
localStorage before navigation.

## Storage Contract

Automation should write `command-center.jwt-auth` before loading the protected route.

Preferred shape:

```json
{
  "authMode": "runtime_credential",
  "tokens": {
    "accessToken": "<MAINSEQUENCE_ACCESS_TOKEN>",
    "tokenType": "Bearer",
    "refreshToken": null
  }
}
```

The frontend also accepts this compact shape for runner convenience:

```json
{
  "authMode": "runtime_credential",
  "MAINSEQUENCE_ACCESS_TOKEN": "<runtime access JWT>"
}
```

The token must be injected through browser storage or another trusted browser-automation channel.
It must not be passed in query params.

## Runtime Resolution

On boot, runtime credential sessions enter the existing `resolving` auth state. The frontend uses
the runtime access JWT to resolve the current user and shell permissions through the same
configured user-details and shell-access endpoints used by canonical JWT sessions.

This keeps the downstream app unchanged:

- app guards still read `useAuthStore().session`
- API clients still read `session.token` and `session.tokenType`
- permission gates still read `session.user.permissions`
- workspace snapshot capture still runs inside the normal mounted browser runtime

## Consequences

Benefits:

- no second API-client auth path
- no query-token transport
- existing route guards and API helpers keep working
- machine-run browser automation can authenticate without interactive login
- runtime credentials cannot accidentally enter refresh/logout behavior

Tradeoffs:

- runtime credentials depend on the backend accepting the same bearer token on user-details,
  shell-access, workspace, widget, and Main Sequence API endpoints required by the automation run
- expired runtime credentials fail as normal authorization failures; the frontend will not refresh
  them
- the token is still powerful while present in browser storage, so automation must manage browser
  context lifetime carefully

## Guardrails

- Keep normal JWT+refresh auth as the canonical human login path.
- Do not add refresh-token behavior to runtime credentials.
- Do not pass `MAINSEQUENCE_ACCESS_TOKEN` through URLs.
- Do not duplicate per-API auth handling; use the shared restored session.
- Treat this mode as a browser automation bootstrap, not as a general alternative login UI.
