# Troubleshooting

Use this page when Command Center is not showing the app, workspace, widget, or data you expected.

## App Or Page Is Missing

Check whether the current user has permission to access the app or surface. Command Center hides
inaccessible apps and redirects away from surfaces that the user cannot open.

Also confirm the extension that contributes the app is enabled in the current build.

## Widget Is Missing

Open the widget catalog and search for the widget by name. If it is absent, the widget extension may
not be enabled or the backend widget registry may not have been published for that environment.

## Widget Shows No Data

Check the widget in this order:

1. Confirm the widget settings are complete.
2. Confirm the upstream widget has data.
3. Confirm the binding points to the intended source widget.
4. Confirm the selected fields exist in the upstream output.
5. Confirm the current time range or filters do not exclude the data.

## Connection Query Fails

Check the selected connection, query parameters, credentials, and user permissions. If the
connection type depends on backend registry synchronization, ask an administrator to confirm the
registry is current.

## Workspace Layout Looks Wrong

Check whether the workspace is in edit mode, graph mode, settings mode, or a public/preview route.
If the layout changed unexpectedly, copy the workspace before making repairs so the current state is
preserved.

## Still Blocked

Capture the workspace name, app surface, widget title, current user role, and the visible error
message before escalating. That context is usually enough to identify whether the issue is content,
permissions, registry state, or backend data.
