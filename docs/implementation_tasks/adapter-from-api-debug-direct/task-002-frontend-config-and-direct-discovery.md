# Task 002: Frontend Config And Direct Discovery

## Objective

Add Adapter From API configuration UI for backend proxy vs debug direct mode and browser-side
contract discovery for direct mode.

## Scope

- Frontend Adapter From API config schema and config editor.
- Browser-side discovery only.
- No direct query execution in this task.

## Implementation Checklist

- [x] Extend `AdapterFromApiPublicConfig` with `transportMode`, `debugApiBaseUrl`,
  `compiledContractSource`, and `compiledContractSourceUrl`.
- [x] Add a `transportMode` schema field.
- [x] Add a `debugApiBaseUrl` schema field.
- [x] Add field-level descriptions for every new schema field.
- [x] Update Adapter From API `usageGuidance` with field-level guidance.
- [x] Update `connections/adapter-from-api/README.md`.
- [x] Update `AdapterFromApiConnectionConfigEditor` with a segmented control or select for
  `Backend Proxy` and `Debug Direct`.
- [x] Show `apiBaseUrl` controls in backend mode.
- [x] Show `debugApiBaseUrl` controls in direct mode.
- [x] Add visible direct-mode explanatory status text when direct mode is selected.
- [x] Do not add direct-mode auth header, token, API-key, or credential inputs.
- [x] Add a browser direct discovery helper.
- [x] Fetch `{debugApiBaseUrl}/.well-known/command-center/connection-contract` from the browser.
- [x] Reject redirects in browser direct discovery.
- [ ] Enforce a client-side response-size limit.
- [x] Validate JSON response shape.
- [x] Normalize the response into `AdapterFromApiCompiledContract`.
- [x] Save `compiledContractSource = "direct"` and `compiledContractSourceUrl`.
- [x] Preserve existing backend discovery behavior for backend mode.
- [x] Show CORS/network errors in the config editor.

## Acceptance Criteria

- [x] Backend mode UI behaves as it does today.
- [x] Direct mode UI accepts `http://127.0.0.1:8021`.
- [x] Direct mode discovery is performed by the browser, not the backend.
- [x] Direct mode stores a compiled contract snapshot on the connection instance.
- [x] Switching modes does not change the connection type id.
- [x] All new fields have `(i)` help through schema descriptions or local editor help.
- [x] Direct mode UI has no auth-header or token fields.

## Verification

- [ ] Add frontend tests for config mode switching.
- [ ] Add frontend tests for direct discovery success.
- [ ] Add frontend tests for direct discovery network/CORS failure rendering.
- [x] Run `npm run check`.
- [ ] Run focused frontend tests for Adapter From API config editor.

## Storage And Backend Contract Assessment

This task writes new Adapter From API public config keys defined in Task 001. It does not change
workspace storage or widget settings.
