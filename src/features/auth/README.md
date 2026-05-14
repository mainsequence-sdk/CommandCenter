# Auth Feature

This feature owns unauthenticated sign-in and password-reset entry points for the Command Center shell.

## Files

- `LoginPage.tsx`: primary production login screen.
- `LoginPageV2.tsx`: alternate login concept route kept for experimentation.
- `ResetPasswordPage.tsx`: forgot-password request flow and token-based password reset confirmation.
- `SocialAuthCallbackPage.tsx`: frontend callback for social sign-in PKCE exchange and browser-session MFA continuation.
- `socialProviderPresentation.tsx`: shared provider naming/icon helpers for login surfaces.

## Notes

- The reset flow uses `/user/api/user/password-reset/`, `/validate/`, and `/confirm/`.
- The login screen now discovers visible social providers from `GET /auth/social/providers/`
  and uses `provider_details[].start_action.url` as the backend-owned entry point for each social
  provider. It must not reconstruct provider start URLs or fall back to `/user/allauth/`,
  `/auth/social/{provider}/callback/`, or backend-root URLs.
- Email signup availability also comes from that same discovery payload. The frontend must not
  render self-service signup unless `provider_details[]` contains `id === "email"` with
  `kind === "email_signup"`.
- The production login page now waits for that social-provider discovery request to resolve before
  rendering the full password/social sign-in surface, so the available auth methods do not pop in
  after the page has already painted.
- When the email signup provider is present, the production login page exposes an inline
  sign-up + verification flow that posts to the backend-owned `submit_action`, `verify_action`,
  and `resend_action` URLs returned by discovery, then bootstraps the standard JWT session from
  `signup_complete.tokens`.
- Social sign-in uses the public `/auth/social/<provider>/start/` PKCE contract with a top-level
  browser navigation, not a popup or background fetch.
- Provider discovery owns the PKCE workflow metadata: the frontend sends the local `/auth/callback`
  as `redirect_uri`, stores the discovery `flow.token_exchange_action.url` with the pending PKCE
  state, and posts the final code exchange there after the frontend callback receives `code` and
  `state`.
- `provider_details[].oauth_callback_url` is provider-registration metadata only. The frontend must
  not use it as its `redirect_uri`, and `/user/allauth/` URLs are not part of this social-login
  frontend flow.
- The frontend callback at `/auth/callback` validates the stored `state` and `code_verifier`,
  exchanges the short-lived code at `POST /auth/social/token/`, then persists the standard local
  JWT session bundle used by password login.
- The same callback route also handles social-signup waitlist redirects. When the backend returns
  `signup_status=waitlisted` with `signup_code=signup_waitlisted`, the frontend must show the
  backend message, must not call `/auth/social/token/`, and must not treat the callback as a login
  success or as an error. The callback parser intentionally prioritizes waitlist first, then MFA,
  then code exchange, then provider error fields, and it hides synthetic
  `@no-email.main-sequence.io` emails.
- Social MFA continuation is browser-session based: `mfa_required` callbacks post to
  `/auth/browser/mfa/verify/` with browser credentials, while `mfa_setup_required` callbacks use
  `/user/api/user/mfa/setup/` and `/user/api/user/mfa/setup/verify/`, then follow the returned
  `redirect_url` until the backend redirects back with a social auth code.
- Authenticated users can also request a password change email from the settings dialog through the shared auth API helpers.
- JWT login now handles three token-endpoint outcomes: direct token success, `mfa_required`
  re-submit with `mfa_code`, and `mfa_setup_required` enrollment before login completion.
- MFA setup uses the backend-returned `setup_url` and `setup_verify_url` exactly as returned.
  The verify request posts `setup_token` and `mfa_code` without relying on cookies or an existing
  authenticated browser session.
- The login UI is an explicit three-state flow: `password_login`, `mfa_verify`, and `mfa_setup`.
- Logged-in MFA management is separate from the pre-login bootstrap: the settings dialog first
  calls `/user/api/user/mfa/status/`, then uses authenticated `/user/api/user/mfa/setup/` and
  `/user/api/user/mfa/setup/verify/` without a `setup_token`.
- Authenticated users can review and revoke their own tracked login sessions from the user
  settings `Security` section, see the MFA-enabled state carried on the signed-in user profile, and
  revoke sessions through `/user/api/user/sessions/`, session revoke, and revoke-others endpoints.
- Session auth now separates organization-scoped admin access from platform-admin access.
- JWT login now resolves in two steps: identity comes from `user_details`, then shell visibility
  comes from `/api/v1/command_center/users/<user_id>/shell-access/`.
- A `403` from shell-access fails the Command Center login with a clear access-denied message
  instead of showing the backend permission-class response directly.
- Organization admin shell access is resolved from `effective_permissions`, not from auth groups.
- Command Center shell visibility is a separate concern: reusable policies come from
  `/api/v1/command_center/access-policies/`, while per-user assignments and overrides come from
  `/api/v1/command_center/users/<user_id>/shell-access/`.
- Runtime credential auth is supported for machine-run browsers that inject
  `command-center.jwt-auth` before navigation. The stored session uses `authMode:
  "runtime_credential"` and `MAINSEQUENCE_ACCESS_TOKEN` or `tokens.accessToken`; requests still
  send `Authorization: Bearer <runtime access JWT>`, but the auth store treats the session as a
  scoped machine/runtime identity with no refresh token and no interactive logout call.
