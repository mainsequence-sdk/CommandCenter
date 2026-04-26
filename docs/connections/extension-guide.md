# Extending Connections

This guide explains how to add a new Command Center connection type. It covers the frontend
definition, user-facing controls, synced metadata, and the backend adapter handoff.

## 1. Choose The Boundary

Before writing code, decide what the connection instance represents.

The boundary should be one backend-authoritative data access scope: one provider account, one
provider endpoint, one selected backend resource, one tenant-scoped service integration, or one
other stable runtime target that the backend can health-check, authorize, cache, and invalidate.

Do not model a connection instance as a single widget query, a throwaway URL, browser-owned
credentials, or a bundle of unrelated providers. Those belong in query payloads, resource payloads,
or separate connection types.

The instance boundary decides what goes into public config. Query payloads should describe one
execution against that configured instance.

## 2. Review Backend Types And Choose A Unique Stable Type Id

Review the backend first. Before picking a frontend id, check the backend connection type registry,
adapter registry, existing synced connection types, and any planned backend adapter work. The id
must be globally unique across Command Center connection types, not just unique in the frontend
folder you are editing.

Pick a stable `ConnectionTypeDefinition.id` only after that review:

```ts
export const MY_CONNECTION_TYPE_ID = "my-source.dataset";
```

This id must be used everywhere:

- frontend `ConnectionTypeDefinition.id`
- synced backend type `typeId`
- persisted instance `typeId`
- backend adapter `type_id`
- audit logs and cache-key metadata

Backend uniqueness is mandatory. If the backend already has an adapter or synced type for the
provider/resource, use that id and extend the existing contract instead of inventing a second one.
If this is genuinely new, reserve the id in the backend adapter plan before building the frontend
definition.

Changing the id creates a new connection type and strands existing instances unless a backend
migration handles them. Do not rename it casually.

## 3. Create The Frontend Module

For a root custom connection:

```text
connections/my-source/
  index.ts
  README.md
  MySourceConnectionConfigEditor.tsx
  MySourceConnectionQueryEditor.tsx
  MySourceConnectionExplore.tsx
```

For an extension-owned connection, place it under the owning extension's `connections/` directory.
Use the local extension README to document ownership.

The entrypoint may export:

```ts
export default mySourceConnection;
export const connections = [mySourceConnection];
export default { connections: [mySourceConnection] };
```

## 4. Define TypeScript Shapes

Define public config, secure config, and query payload types near the connection definition.

```ts
export interface MySourcePublicConfig {
  baseUrl?: string;
  defaultLimit?: number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export interface MySourceSecureConfig {
  apiToken?: string;
}

export type MySourceConnectionQuery =
  | { kind: "rows"; table: string; columns?: string[]; limit?: number }
  | { kind: "metadata"; table: string };
```

Public config is stable instance state. Secure config is write-only. Query payloads are execution
state.

## 5. Define Schemas

Every public and secure field needs a schema field with a useful `description`.

```ts
publicConfigSchema: {
  version: 1,
  sections: [
    {
      id: "provider",
      title: "Provider",
      description: "Provider endpoint and runtime defaults.",
    },
  ],
  fields: [
    {
      id: "baseUrl",
      sectionId: "provider",
      label: "Base URL",
      description: "Provider API root used by the backend adapter.",
      type: "string",
      required: true,
    },
    {
      id: "defaultLimit",
      sectionId: "provider",
      label: "Default row limit",
      description: "Backend default row limit when a query does not provide maxRows.",
      type: "number",
      required: false,
      defaultValue: 1000,
    },
  ],
}
```

Schema descriptions are UI help text. They must match the semantics in `usageGuidance`.

Use `visibleWhen` for conditional fields such as auth mode, endpoint mode, TLS options, or Google
Managed Prometheus settings.

## 6. Define Query Models

Each query model should match one backend dispatch path.

```ts
queryModels: [
  {
    id: "rows",
    label: "Rows",
    description: "Reads rows from one table in the configured provider.",
    outputContracts: ["core.tabular_frame@v1"],
    defaultOutputContract: "core.tabular_frame@v1",
    defaultQuery: { kind: "rows", columns: [] },
    controls: ["table", "columns", "limit"],
    supportsMaxRows: true,
  },
  {
    id: "metadata",
    label: "Metadata",
    description: "Loads metadata for one table.",
    outputContracts: ["core.tabular_frame@v1"],
    defaultQuery: { kind: "metadata" },
    controls: ["table"],
    supportsMaxRows: false,
  },
]
```

Rules:

- `id` should equal `query.kind`
- `outputContracts` must match backend frames
- `timeRangeAware` means the workbench sends top-level `timeRange`
- `supportsVariables` means the workbench shows variables and sends top-level `variables`
- `supportsMaxRows: false` hides and omits top-level `maxRows`
- `controls` documents what the query editor renders; it does not render fields by itself

## 7. Add Editors

Use a `configEditor` when schema fields alone are not enough. Examples:

- resource picker
- provider metadata preview
- dependent fields
- validation that needs local context

Use a `queryEditor` for provider-specific query payloads. It receives selected instance and query
model context, so it can render defaults without duplicating setup state.

```tsx
export function MySourceConnectionQueryEditor({
  value,
  onChange,
  disabled,
  connectionInstance,
  queryModel,
}: ConnectionQueryEditorProps<MySourceConnectionQuery>) {
  if (queryModel?.id === "rows") {
    return (
      <ConnectionQueryEditorSection title="Rows">
        <QueryTextField
          label="Table"
          value={"table" in value ? value.table : undefined}
          onChange={(table) => onChange({ kind: "rows", table: table ?? "" })}
          disabled={disabled}
        />
      </ConnectionQueryEditorSection>
    );
  }

  return null;
}
```

Use shared controls from `src/connections/components/ConnectionQueryEditorFields.tsx`:

- `ConnectionQueryEditorSection`
- `ConnectionQueryField`
- `QueryTextField`
- `QueryNumberField`
- `QuerySqlField`
- `QueryStringListField`

Do not make editors store provider credentials, mutate connection instances, or bypass the backend
adapter.

## 8. Prefer The Shared Workbench

The shared `ConnectionQueryWorkbench` handles:

- selecting a connection instance
- selecting a query model
- rendering the connection-specific `queryEditor`
- rendering date runtime controls for `timeRangeAware` models
- rendering variables and max-row controls when supported
- generating the `ConnectionQueryRequest`
- running test queries
- previewing normalized responses

Add a custom `exploreComponent` only when the source needs a workflow the workbench cannot express.
Even then, use `queryConnection`, `fetchConnectionResource`, and
`ConnectionQueryResponsePreview` for runtime calls and previews.

## 9. Write Usage Guidance

`usageGuidance` is Markdown synced to the backend and shown to users/agents. It must explain:

- purpose
- when to use
- when not to use
- public config fields
- secure config fields
- query models and payloads
- resources and payloads
- output contracts
- backend adapter ownership
- cache/dedupe behavior
- safety constraints and rejected operations

Field-level guidance must include:

- key exactly as stored
- UI label
- type
- required or optional
- default value
- example value
- what it controls
- validation or security constraints
- whether frontend, backend adapter, or both use it
- UI help text

## 10. Add Examples

Examples should be realistic but not secret-bearing:

```ts
examples: [
  {
    title: "Read rows",
    publicConfig: {
      baseUrl: "https://api.example.com",
      defaultLimit: 1000,
    },
    query: {
      kind: "rows",
      table: "orders",
      columns: ["created_at", "status", "amount"],
    },
  },
]
```

Never include live tokens, passwords, private keys, service-account JSON, or internal-only hosts in
examples.

## 11. Register And Sync

The app registry auto-loads connection definitions from root custom connections and extension
connection modules. Admin Settings publishes the sync payload.

The sync payload includes:

- type id and version
- title, description, source, category, icon, tags
- capabilities and access mode
- public and secure schemas
- query models
- required permissions
- usage guidance
- examples
- active state

It does not include React editors or runtime functions. If the backend type has not been synced and
activated, Add New should not show it as an available connection type.

## 12. Implement The Backend Adapter

The backend adapter must implement the same `type_id`. See:

- [Adapters](./adapters/README.md)
- [Python Adapters](./adapters/python/README.md)
- [Python Contract](./adapters/python/contract.md)
- [Python Adapter Guide](./adapters/python/adapter-guide.md)

Do not treat the frontend definition as complete until the backend can create instances, store
secrets, health check, execute supported query/resource operations, enforce permissions, and return
normalized frames.

## Review Checklist

- connection type id matches backend adapter `type_id`
- public config TypeScript type, schema, usage guidance, examples, and backend model agree
- secure config schema contains only write-only fields
- every schema field has a description
- query model ids match `query.kind`
- query model output contracts match backend frames
- `controls`, `timeRangeAware`, `supportsVariables`, and `supportsMaxRows` match the query editor
  and backend request handling
- config editor edits stable instance config only
- query editor edits query payload only
- Explore uses shared workbench unless there is a specific reason not to
- usage guidance has complete field-level docs
- examples are realistic and contain no secrets
- backend adapter contract is documented
- storage/backend contract impact is called out
- `npm run check` passes when TypeScript changed
