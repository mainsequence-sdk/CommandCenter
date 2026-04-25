---
name: connection_maintenance
description: Use when building, modifying, refactoring, reviewing, or documenting Command Center connections, connection type definitions, connection config editors, Explore UIs, backend adapter contracts, connection registry sync, or connection usage guidance. Ensures every connection has clear agent-readable guidance, field-level examples, local README documentation, and backend contract impact assessment.
---

# Connection Maintenance

Use this skill for any Command Center connection work.

## Required Workflow

1. Read the local context before editing:
   - the nearest connection directory `README.md`
   - the connection type definition file
   - the connection config editor, query editor, and Explore UI files when present
   - backend adapter contract docs or ADRs when the change touches runtime execution, caching, auth, resources, queries, or response shape
   - registry sync/runtime files when adding a new connection type

2. Keep connection usage guidance current.
   - Every connection type must define useful `usageGuidance` in its `ConnectionTypeDefinition`.
   - `usageGuidance` is agent-facing and catalog-facing. It should explain what the connection does, when to use it, when not to use it, how it is configured, what queries/resources it supports, what it returns, and what the backend adapter owns.
   - New connection modules should include a local `README.md` or update the nearest connection directory `README.md`.
   - Do not ship vague guidance such as “connects to data” or “run queries”. Name the real backend/resource, query models, and important constraints.

3. Include field-level guidance for configurable fields.
   For every public or secure config field, usage guidance or README docs must include:
   - field key exactly as stored
   - UI label
   - type
   - required/optional
   - default value, if any
   - example value
   - what the field controls
   - validation or security constraints
   - whether the frontend, backend adapter, or both use it
   - the exact `(i)` help text exposed in the connection configuration UI

4. Every configurable field must expose an `(i)` help affordance.
   - Every `publicConfigSchema.fields[]` and `secureConfigSchema.fields[]` entry must include a
     clear `description`.
   - That `description` is the source for the visible `(i)` help/tooltip in connection forms.
   - The schema `description` must match the same semantics documented in `usageGuidance`; do not
     let tooltip copy drift from agent-facing guidance.
   - Descriptions should explain what the field controls, when it matters, defaults or examples
     when useful, and constraints that affect valid input.
   - If the shared connection form does not currently render schema descriptions as `(i)` help,
     add or update the shared form instead of creating local one-off tooltip implementations.

5. Keep connection definition wiring aligned.
   - `id`, `version`, `title`, `description`, `source`, `category`, `capabilities`, `accessMode`, schemas, editors, query models, permissions, examples, and `usageGuidance` must describe the same behavior.
   - `publicConfigSchema` and `secureConfigSchema` must match the TypeScript config types.
   - New fields added to TypeScript config types must also be added to schemas, schema
     descriptions, docs, examples, and usage guidance unless intentionally internal and not
     persisted.
   - `queryModels` must list real query kinds, output contracts, time-range awareness, and variable support accurately.
   - `examples` should include at least one realistic public config and one realistic query for every primary query model.
   - `requiredPermissions` must name the minimum frontend-advertised permission. Backend object-level checks still apply.

6. Keep config editors and Explore UIs scoped to the connection contract.
   - Config editors should configure stable connection instance state, not ad hoc query state.
   - Explore UIs should send typed query/resource payloads through `queryConnection`, `fetchConnectionResource`, or the matching connection runtime API.
   - Do not bypass a connection backend adapter from a widget or Explore UI unless the connection is explicitly a frontend-only compatibility shim.
   - If a connection is resource-scoped, the configured resource should be authoritative. Query payloads should not silently override it.
   - Show validation and backend errors explicitly enough for a user or agent to fix the configuration.

7. Document backend adapter ownership.
   When adding or changing a backend-routed connection, document:
   - `type_id`
   - public and secure config fields
   - query kinds and payloads
   - resource names and payloads
   - health-check behavior
   - permission checks
   - cache policy and cache-key dimensions
   - in-flight dedupe policy
   - response normalization and output contracts
   - unsafe operations that must be rejected

8. Assess storage and backend contract impact.
   - If public config, secure config, query payload, resource payload, health result, response frame shape, registry sync payload, persisted connection instance shape, or backend adapter semantics change, explicitly assess whether the backend contract changes.
   - If backend support is required and not present in this repo, leave a documented backend task instead of pretending the frontend change is complete.
   - If only copy changes in `usageGuidance` or `README.md`, the backend payload shape is unchanged.

9. Verify before finishing:
   - run `npm run check` when TypeScript files changed
   - confirm the connection is registered in the owning extension or core registry
   - confirm new connection directories or major modules have README documentation
   - confirm every configurable field has field-level guidance and examples
   - confirm every connection schema field has a `description` suitable for `(i)` help
   - confirm query/resource examples match the TypeScript types
   - mention any check that could not be run

## Usage Guidance Style

Write `usageGuidance` as stable, structured Markdown. It should help agents choose and configure
the connection without reading implementation code.

Recommended sections:

```md
## purpose

Connects widgets and Explore flows to one Main Sequence Simple Table through backend-scoped SQL execution.

## whenToUse

- Use when a workspace needs SQL access to one selected Simple Table.

## whenNotToUse

- Do not use for arbitrary database access; use the PostgreSQL connection instead.

## configurationFields

### simpleTableId

- Label: Simple Table
- Type: number
- Required: yes
- Default: none
- Example: 123
- Used by: frontend and backend adapter
- Meaning: authoritative Simple Table id selected during connection setup.
- Constraints: must be a positive integer; query payloads must not override it.
- UI help: Select the Simple Table this connection is allowed to query. The backend treats this id as authoritative and rejects queries for other tables.

## queryModels

### simple-table-sql

- Payload: `{ "kind": "simple-table-sql", "sql": "select * from {{simple_table}} limit 100" }`
- Returns: `core.tabular_frame@v1`
- Notes: backend must reject unsafe SQL and expand `{{simple_table}}`.

## backendOwnership

- Backend resolves credentials, permissions, physical resource names, cache, dedupe, and response normalization.
```

## README Style

Use README files for developer-facing maintenance details:

- module purpose and ownership
- entry points
- important dependencies
- registry wiring
- backend adapter contract
- implementation constraints
- known migration or compatibility behavior

Do not use README as a changelog. Put user/agent-facing selection and configuration semantics in
`usageGuidance`; put implementation ownership and maintenance constraints in README.

## New Connection Checklist

- [ ] Add connection type definition.
- [ ] Add public/secure config TypeScript types.
- [ ] Add public/secure config schema fields.
- [ ] Add a `description` to every schema field for `(i)` help.
- [ ] Add config editor when fields are not trivial.
- [ ] Add query editor or Explore UI when the connection owns query semantics.
- [ ] Add query models with output contracts.
- [ ] Add examples for config and queries.
- [ ] Add specific `usageGuidance` with every configurable field documented.
- [ ] Ensure usage guidance includes the same field meaning as the schema `(i)` help.
- [ ] Add or update local README.
- [ ] Register the connection in the owning extension/core registry.
- [ ] Document backend adapter contract and open backend tasks if not implemented.
- [ ] Run `npm run check`.
