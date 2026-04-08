# App Layout

Shared shell navigation and chrome for the Command Center application.

## Main Entry Points

- `Topbar.tsx`: global top navigation, search, favorites, notifications, user menu, and current-app navigation.
- `Sidebar.tsx`: left rail app navigation.
- `AppNavigationPanel.tsx`: per-app left-side surface navigation panel.
- `AppSurfaceSelector.tsx`: topbar surface switcher for the current app.
- `FavoriteSurfacesMenu.tsx`: favorites flyout for saved surfaces and workspaces.
- `SettingsDialog.tsx`: shell-level settings and diagnostics.

## Navigation Behavior

- The current-app chip in `Topbar.tsx` is a navigation control, not an information dialog trigger.
- Clicking the current-app chip should navigate to the app home route via `getAppPath(app.id)`.
- Surface-level navigation stays in `AppSurfaceSelector.tsx`; it is the control for switching within the current app.
- App metadata must not interrupt normal navigation flows with a modal on the primary app-title click path.
- The topbar now separates the `Organization Admin` menu from `Admin Settings`.
- `Organization Admin` is organization-scoped navigation. `Admin Settings` is a separate
  platform-admin-only modal and must not be exposed through the org-admin menu.

## Maintenance Notes

- Keep the topbar, sidebar, and per-app navigation semantics aligned. A control that looks like navigation should navigate.
- If app details or metadata are needed later, expose them behind an explicit secondary affordance rather than the primary app-title control.
