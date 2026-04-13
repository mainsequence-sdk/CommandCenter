# ADR: Shared AppComponent Discovery and Safe-Response Caching

- Status: Proposed
- Date: 2026-04-03
- Related:
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)

## Context

`AppComponent` is now a first-class executable widget and a reusable API source for downstream
bindings. That makes repeated identical requests much more likely:

- several widgets can point at the same API base URL and operation
- a single workspace refresh can trigger multiple equivalent `GET` requests
- settings discovery and runtime execution both need the same `/openapi.json` document

Without a shared cache layer, the frontend fans out duplicate network traffic even when:

- the user did not explicitly ask for a fresh request
- the upstream endpoint is safe to reuse for a short interval
- the same user is executing the same request from multiple widgets

That behavior is especially wasteful for AppComponent source widgets that exist specifically so
other widgets can bind to one canonical API-backed source.

## Decision

We will add a shared in-memory cache policy for AppComponent transport behavior.

The policy is:

- cache OpenAPI discovery globally, not per widget instance
- cache safe API responses only for `GET` and `HEAD`
- key cached responses by user, auth mode, HTTP method, full request URL, and request body hash
- keep the safe-response TTL intentionally small
- bypass the safe-response cache for explicit user-triggered submit/test flows
- make cache TTLs part of the general app configuration in `config/command-center.yaml`

## Configuration

The cache TTLs live in the shared app config:

```yaml
app:
  cache:
    app_component_openapi_document_ttl_ms: 300000
    app_component_safe_response_ttl_ms: 30000
```

These values are read through [`src/config/command-center.ts`](../src/config/command-center.ts)
and consumed by the AppComponent transport layer in
[`src/widgets/core/app-component/appComponentApi.ts`](../src/widgets/core/app-component/appComponentApi.ts).

This keeps deployment-level tuning in config rather than hardcoded inside widget code.

## Architecture

### 1. Global OpenAPI discovery cache

AppComponent OpenAPI discovery is cached in-memory across widget instances for the current browser
session.

Cache key:

- current user id
- auth mode
- resolved base URL

The cache is shared by:

- the runtime widget body
- the settings test/explorer flow
- the executable graph runner path

### 2. Shared safe-response cache

Safe API responses are cached in-memory only for:

- `GET`
- `HEAD`

Cache key:

- current user id
- auth mode
- normalized HTTP method
- full request URL
- request body hash

Only successful safe responses are stored.

### 3. In-flight deduplication

Both the OpenAPI cache and the safe-response cache dedupe identical in-flight requests so one burst
of equivalent executions collapses into one network call.

### 4. Execution-reason gating

The safe-response cache is used only for shared refresh-style execution reasons:

- `dashboard-refresh`
- `manual-recalculate`

It is intentionally bypassed for:

- `manual-submit`
- `settings-test`

This preserves the user expectation that explicit submit/test actions hit the API freshly, while
automatic graph refresh work can reuse recent safe responses.

## Consequences

Positive:

- repeated AppComponent source widgets stop hammering the same safe endpoint on every refresh
- OpenAPI discovery stops being re-fetched by every execution cycle
- cache tuning becomes a deployment concern rather than a widget-local code edit
- the platform keeps one transport policy for both runtime and settings flows

Negative:

- safe cached responses can be stale for up to the configured TTL
- cache behavior currently exists only in browser memory, so it resets on reload
- non-safe methods still execute every time by design

## This ADR Does Not Decide

This ADR does not decide:

- persistent or cross-tab request caching
- server-side caching headers or proxy caching strategy
- opt-in caching for mutating HTTP methods
- per-widget overrides for cache TTLs
- whether future non-AppComponent executable widgets should reuse the same cache infrastructure
