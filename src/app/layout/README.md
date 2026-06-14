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
- `SettingsDialog.tsx`: shell-level settings and diagnostics.
  It now also merges registry-backed extension-contributed settings sections for `user` and
  `admin` audiences into the shared left-nav dialog shell.
  Grouped extension contributions in the user settings nav render as compact non-wrapping
  disclosure rows, and the `Main Sequence AI` group is intentionally pinned to the bottom of that
  nav.
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
- The topbar now separates the `Organization Admin` menu from `Admin Settings`.
- `Organization Admin` is organization-scoped navigation. `Admin Settings` is a separate
  platform-admin-only modal and must not be exposed through the org-admin menu.
- Platform-owned controls such as widget-registry publication belong in `Admin Settings`, not in
  the organization-admin surface tree.
- Extension-owned settings pages should render through the shared `SettingsDialog` contribution
  contract instead of creating one-off shell modals.
- Shell state can now target a specific contributed user-settings section so feature UIs can open
  the shared dialog directly to the relevant extension-owned page.

## Maintenance Notes

- Keep the topbar, sidebar, and per-app navigation semantics aligned. A control that looks like navigation should navigate.
- If app details or metadata are needed later, expose them behind an explicit secondary affordance rather than the primary app-title control.
- Keep shell settings chrome centralized. Extensions can contribute sections, but the shell still
  owns the modal, nav, and interaction model.
