# Auth

Shared authentication client code for Command Center.

## Main Entry Points

- `api.ts`: authenticated and unauthenticated auth endpoint helpers for login-adjacent flows,
  social auth, MFA, tracked sessions, profile-picture upload, WebSocket tickets, and self-service
  account deletion.
- `auth-store.ts`: client session store, refresh lifecycle, and logout behavior.
- `jwt-auth.ts`: JWT parsing, claim mapping, persistence, and session bootstrap.
- `mock-jwt-auth.ts`: mock auth transport and in-memory endpoint behavior used when
  `env.useMockData` is enabled.
- `types.ts`: shared app-user and auth-facing type definitions.

## Maintenance Notes

- Keep `api.ts` endpoint helpers aligned with backend auth route semantics instead of deriving
  ad hoc URLs in UI components.
- Social provider discovery is action-driven. Use `provider_details[].start_action.url` and
  `flow.token_exchange_action.url`, keep `provider_details[].oauth_callback_url` as OAuth-provider
  registration metadata only, and never route the frontend social flow through `/user/allauth/`,
  `/auth/social/{provider}/callback/`, or backend-root URLs.
- The same discovery payload is also the source of truth for email signup. Only expose self-service
  signup when `provider_details[]` includes the `email` provider with `kind: email_signup`, and
  use the returned submit/verify/resend action URLs instead of reconstructing `/auth/signup/...`
  paths in the UI.
- Any new authenticated self-service account action added to `api.ts` should usually be mirrored in
  `mock-jwt-auth.ts` so mock mode keeps the same shell flows testable.
- Destructive self-service actions such as account deletion should leave session teardown to the
  caller after the backend confirms success.
- Self-service account deletion uses `DELETE /user/api/user/delete-account/`. Only a `200` with
  `code=account_deleted` should clear local auth state; `409` blockers must keep the user signed in
  and surface the backend reason/CTA.
- JWT session bootstrap must not use the backend numeric user id as the frontend identity. The
  shell-access lookup is keyed by `uid`; JWT claim mapping resolves the user identity from
  `user_uid`, and `session.user.id` is only a compatibility alias that resolves from `uid` when
  available. Persisted auth sessions intentionally omit `user.id` so stale numeric ids from older
  sessions are not reused.
