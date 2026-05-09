# Permissions

Permissions control which apps, surfaces, widgets, connections, and actions are visible to a user.
If something is missing from the interface, permissions are one of the first things to check.

## What Permissions Affect

Permissions can affect:

- Whether an app appears in navigation.
- Whether a surface is accessible inside an app.
- Whether a widget catalog entry is visible.
- Whether a connection can be queried.
- Whether workspace actions such as publishing are available.
- Whether administrative tools are visible.

## Common Symptoms

- An app is missing from the sidebar.
- A page redirects back to another surface.
- A widget catalog entry is unavailable.
- A connection appears disabled or cannot be queried.
- A publish, admin, or configuration action is hidden.

## What To Check

1. Confirm the user is signed in to the expected organization.
2. Confirm the user's role has the required permission.
3. Confirm the extension or app is enabled in the current build.
4. Confirm the backend registry contains the relevant widget or connection type when the feature
   depends on backend registration.
5. Ask an organization administrator to inspect access-control surfaces when the issue is
   role-specific.

## Admin Guidance

Permissions should match real responsibilities. Avoid giving broad administrative access only to
make a single app visible. Prefer adding the precise app, connection, or action permission that the
user needs.
