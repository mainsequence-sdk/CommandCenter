# Task 003: Direct Execution Runtime And Workspace Routing

## Objective

Route Adapter From API query and health execution through the browser when a connection instance is
in debug direct mode, resolve operation metadata locally from `compiledContract`, and keep widget
bindings and workspace storage unchanged.

## Scope

- Frontend execution routing.
- Direct-mode query/test helpers and local compiled-contract metadata lookup.
- Workspace and Explore integration.
- No new connection type.

## Implementation Checklist

- [x] Add an Adapter From API direct runtime module.
- [x] Detect direct mode from `connectionInstance.publicConfig.transportMode === "direct"`.
- [x] Route direct-mode Explore query execution to the direct runtime.
- [x] Route direct-mode workspace source execution to the direct runtime.
- [x] Keep backend execution for every non-direct Adapter From API instance.
- [x] Implement direct operation lookup by `operationId`.
- [x] Validate path parameters against the compiled operation contract.
- [x] Validate query parameters against the compiled operation contract.
- [x] Validate user-configurable headers against the compiled operation contract.
- [x] Do not use backend-only secret injection in direct mode.
- [x] Reject user-configurable Authorization, cookie, API-key, and auth-token headers.
- [x] Do not attach local-only auth headers or browser session-storage tokens.
- [x] Build browser `fetch` requests against `debugApiBaseUrl`.
- [x] Apply path parameter interpolation safely.
- [x] Apply query string parameters safely.
- [x] Apply request body and content type from the operation contract.
- [x] Apply response mapping to return the same `ConnectionQueryResponse` expected by widgets.
- [x] Preserve `core.tabular_frame@v1` output behavior for tabular mappings.
- [ ] Add parity fixtures proving the same raw upstream response and `responseMappingId` produce
  the same normalized `ConnectionQueryResponse` in backend and direct modes.
- [x] Implement direct health check from the compiled contract health operation.
- [x] Implement direct resource lookups needed by the query editor, or keep resource lookups local
  from `compiledContract` when possible.
- [x] Surface direct-mode runtime errors with enough provider/contract detail for debugging.
- [x] Do not persist any direct-mode runtime result into workspace storage.
- [x] Do not change widget `connectionRef`, query payload, or binding schema.

## Acceptance Criteria

- [x] A widget bound to an Adapter From API connection works in backend mode.
- [x] The same widget works in direct mode without changing its settings.
- [x] Direct mode query execution calls `debugApiBaseUrl` from the browser.
- [x] Backend query endpoint is not called for direct-mode query execution.
- [x] Switching direct mode back to backend mode requires no widget changes.
- [ ] Direct mode produces the same normalized `ConnectionQueryResponse` as backend mode for the
  same raw response and operation mapping.
- [x] Direct mode never injects backend-stored secrets.
- [x] Direct mode rejects Command Center-managed auth headers in user-configurable headers.

## Verification

- [ ] Add unit tests for direct request construction.
- [ ] Add unit tests for response mapping.
- [ ] Add backend/direct response parity tests for `core.tabular_frame@v1`.
- [ ] Add unit tests for backend-only secret rejection.
- [ ] Add unit tests proving direct requests do not include local auth headers or tokens.
- [ ] Add workspace runtime tests confirming `connectionRef` remains unchanged.
- [ ] Add integration or mocked fetch tests proving backend query endpoints are bypassed in direct
  mode.
- [x] Run `npm run check`.
- [ ] Run focused workspace/connection runtime tests.

## Storage And Backend Contract Assessment

Workspace storage remains unchanged. Connection instance public config uses the keys introduced in
Task 001. Direct runtime output must match the existing connection query response contract so
consumer widgets do not need migration.
