# Auth Feature

This feature owns unauthenticated sign-in and password-reset entry points for the Command Center shell.

## Files

- `LoginPage.tsx`: primary production login screen.
- `LoginPageV2.tsx`: alternate login concept route kept for experimentation.
- `ResetPasswordPage.tsx`: forgot-password request flow and token-based password reset confirmation.

## Notes

- The reset flow uses `/user/api/user/password-reset/`, `/validate/`, and `/confirm/`.
- Authenticated users can also request a password change email from the settings dialog through the shared auth API helpers.
- Session auth now separates organization-scoped admin access from platform-admin access.
- JWT login now resolves in two steps: identity comes from `user_details`, then shell visibility
  comes from `/api/v1/command_center/users/<user_id>/shell-access/`.
- Organization admin shell access is resolved from `effective_permissions`, not from auth groups.
- Command Center shell visibility is a separate concern: reusable policies come from
  `/api/v1/command_center/access-policies/`, while per-user assignments and overrides come from
  `/api/v1/command_center/users/<user_id>/shell-access/`.
