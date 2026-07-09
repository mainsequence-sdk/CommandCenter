# App Layout

Shared shell navigation and chrome for the Command Center application.

## Main Entry Points

- `Topbar.tsx`: global top navigation, search, favorites, notifications, user menu, and current-app navigation.
  It also owns the user credit summary bar beside favorites. The bar reads
  `/user/api/user/credits/summary/`, always renders `user_budget`, renders a second slim
  organization-consumption bar only when `organization_consumption` is present, and must not branch
  on scope or UID fields. When `user_budget.monthly_limit_cents` is absent or zero, the user rail is
  consumption-only and renders as 100% instead of showing an empty budget cap.
- `Sidebar.tsx`: left rail app navigation.
- `AppNavigationPanel.tsx`: per-app left-side surface navigation panel.
- `AppSurfaceSelector.tsx`: topbar surface switcher for the current app.
- `FavoriteSurfacesMenu.tsx`: favorites flyout for saved surfaces and workspaces.
- `SettingsDialog.tsx`: reusable account/platform settings section renderer. Account and platform
  sections are composed by the routed Settings module under `src/features/settings/`.
  The shared account section also owns the authenticated profile-picture upload action and updates
  the in-memory shell session avatar immediately after the dedicated `/user/api/user/profile-picture/`
  upload succeeds.
  The shared `General` user section also owns the self-service delete-account entrypoint and
  warning confirmation modal, while the actual account-profile surface stays in `Account`.
  The user audience now includes a built-in `Security` section that lists tracked sessions for the
  current user, reads MFA status from the authenticated MFA status endpoint, supports authenticated
  MFA setup and verification, and supports revoking one session or revoking all other sessions.

## Navigation Behavior

- The current-app chip in `Topbar.tsx` is a navigation control, not an information dialog trigger.
- Clicking the current-app chip should navigate to the app home route via `getAppPath(app.id)`.
- Surface-level navigation stays in `AppSurfaceSelector.tsx`; it is the control for switching within the current app.
- App metadata must not interrupt normal navigation flows with a modal on the primary app-title click path.
- Settings is a routed app at `/app/settings/*`. User settings, organization admin, billing,
  organization-owned application settings, extension-contributed settings, and platform diagnostics
  are reached through that app.
- Organization-admin pages keep their existing `org_admin:view` gates. System controls are shown
  through backend-owned shell access inside the Settings app.
- Shell state can still target a specific contributed user-settings section; the sidebar translates
  that legacy modal intent into the closest routed Settings page.

## Maintenance Notes

- Keep the topbar, sidebar, and per-app navigation semantics aligned. A control that looks like navigation should navigate.
- If app details or metadata are needed later, expose them behind an explicit secondary affordance rather than the primary app-title control.
- Keep Settings chrome centralized in `src/features/settings/`. Extensions can contribute sections,
  but they should render inside the routed Settings module instead of introducing new shell modals.
