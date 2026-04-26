# Connections

Connections are Command Center's first-class data-access model. They let extensions describe a
provider or resource, let administrators create backend-owned connection instances, and let widgets
or Explore surfaces query those instances through normalized contracts.

This docs section is for developers adding or changing connection types. Code-local README files
still document their owning modules; this section explains the extension model and backend adapter
contract across the platform.

## Reading Order

1. [Models and Contracts](./models-and-contracts.md): the core frontend and runtime shapes.
2. [Extension Guide](./extension-guide.md): how to create a new connection type.
3. [Adapters](./adapters/README.md): backend adapter responsibilities and lifecycle.
4. [Python Adapters](./adapters/python/README.md): FastAPI and Pydantic adapter contract.

Related ADRs:

- [First-Class Connection Model](../adr/adr-first-class-connection-model.md)
- [Connection-First Workspace Dataflow](../adr/adr-connection-first-workspace-dataflow.md)
- [Standardized Connection Result Contracts](../adr/adr-standardized-connection-result-contracts.md)
- [PostgreSQL Custom Connection](../adr/adr-postgresql-connection.md)
- [Main Sequence Simple Table Connection](../adr/adr-main-sequence-simple-table-connection.md)

## What A Connection Is

A connection has three layers:

- `ConnectionTypeDefinition`: extension-owned frontend metadata and authoring UI.
- `ConnectionInstance`: backend-owned configured data source, including public config and secret
  field masks.
- Backend adapter: runtime implementation that performs health checks, queries, resources,
  streams, permissions, secrets, caching, and response normalization.

The frontend type describes what is possible. The backend adapter makes it real.

## Where Code Lives

Frontend type definitions can live in either place:

- root custom connections: `connections/<source>/index.ts`
- extension-owned connections: `extensions/<extension>/.../connections/*.ts`

Shared frontend framework code lives in `src/connections/`. Do not put developer guide material
there unless it is implementation-local documentation for that package.

Backend adapter documentation lives here:

- `docs/connections/adapters/`
- `docs/connections/adapters/python/`

## Extension Checklist

For a new connection type:

- choose a stable `id`; this becomes backend `type_id`
- define TypeScript public config, secure config, and query payload types
- add `publicConfigSchema` and `secureConfigSchema` with field descriptions
- add query models with output contracts and control metadata
- add a config editor when schema fields alone are not enough
- add a query editor when raw JSON is not acceptable for normal users
- add an Explore component only when the shared workbench is not enough
- add realistic examples and complete `usageGuidance`
- register the connection through the app registry
- sync the type to the backend registry
- implement the matching backend adapter
- document adapter behavior in the connection-local README and in these docs when the shared
  contract changes

## Storage Contract Rule

Frontend code may store `ConnectionRef` values in widgets and workspaces:

```ts
{ uid: string; typeId: string }
```

Frontend code must not store provider URLs, credentials, tokens, mutable display names, decrypted
secrets, or backend-only resource handles in workspace/widget state.

Changing public config, secure config, query payloads, resource payloads, health results, sync
metadata, persisted connection instance shape, or normalized frame contracts is a backend contract
change. Document it and coordinate the adapter update.
