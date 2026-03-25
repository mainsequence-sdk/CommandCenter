# Auth Feature

This feature owns unauthenticated sign-in and password-reset entry points for the Command Center shell.

## Files

- `LoginPage.tsx`: primary production login screen.
- `LoginPageV2.tsx`: alternate login concept route kept for experimentation.
- `ResetPasswordPage.tsx`: forgot-password request flow and token-based password reset confirmation.

## Notes

- The reset flow uses `/user/api/user/password-reset/`, `/validate/`, and `/confirm/`.
- Authenticated users can also request a password change email from the settings dialog through the shared auth API helpers.
