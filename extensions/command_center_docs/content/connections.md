# Connections

Connections make external or backend-managed data available to Command Center. They are usually used
by query widgets, streaming widgets, workspaces, and product-specific app surfaces.

## Connection Types

A connection type defines what kind of system can be queried and what configuration is required. A
type might represent a database, market data provider, metrics backend, API adapter, or another
backend-managed source.

## Connection Instances

A connection instance is the configured connection that users select or query. The available
instances depend on the backend registry, organization configuration, and the current user's
permissions.

## Querying Data

The normal flow is:

1. Choose a widget or app surface that supports connections.
2. Select the connection type or instance.
3. Configure the query fields.
4. Run or preview the query.
5. Bind the result to downstream widgets if needed.

## If A Connection Is Missing

Check these items first:

- The extension that contributes the connection type is enabled in this build.
- The backend registry has the connection type registered.
- The current organization has access to the connection instance.
- The current user has the required permission for the connection.
- Required credentials or backend configuration exist for the environment.

## Safety

Treat connection output as live application data. Avoid putting secrets in workspace notes, widget
titles, query labels, or exported content.
