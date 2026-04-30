# ADR 046: WebSocket Stream Survivability And Reconnect Supervision

- Status: Partially Implemented
- Date: 2026-04-30
- Related:
  - [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - Backend ADR 015: Workspace WebSocket Connections
  - Backend ADR 016: Binance WebSocket Market Streams
  - Backend ADR 017: WebSocket Ticket Auth For SPA

## Context

The current `connection-stream-query` runtime exposes lifecycle state such as `connecting`, `live`,
`reconnecting`, `error`, and `closed`, but it does not implement a full reconnect supervisor for
the browser-to-backend WebSocket.

Today the stream source can:

- mint a short-lived WebSocket ticket
- open one backend WebSocket
- send the query-shaped subscribe payload
- normalize `ack`, `snapshot`, `delta`, `heartbeat`, `error`, and `complete` messages
- surface lifecycle state in widget runtime and the Explore test panel

What it does not reliably do today:

- retry after browser-side socket close or transport error
- detect stale streams from missing heartbeats or prolonged silence
- reacquire a fresh ticket before reconnect
- apply bounded retry backoff with jitter
- escalate a prolonged disconnect clearly to the user
- distinguish intentional close from unintentional disconnect in a durable supervisor

That leaves a critical gap: a widget can show `reconnecting`, `closed`, or `error` without any
real reconnect loop successfully creating a new subscription. Some streams therefore remain dead
until the widget remounts or the user intervenes.

This gap also exposes the correct ownership boundary:

- the backend owns provider-side survivability, such as Binance reconnects, upstream resume, and
  adapter continuity
- the frontend owns browser-side survivability for the widget socket to our backend

The backend cannot reopen a browser WebSocket after the browser loses that connection. The frontend
must supervise that lifecycle.

## Decision

Add a source-owned reconnect supervisor to `connection-stream-query`.

The reconnect supervisor lives in the stream source runtime, not in downstream graph, table,
statistic, or OHLC widgets. Downstream consumers remain socket-agnostic and continue consuming the
same normalized `dataset` / `updates` publication contracts.

The source runtime must:

- detect browser-side disconnects
- preserve the last good retained visible state while degraded
- transition into an explicit reconnecting lifecycle
- schedule reconnect attempts with bounded backoff and jitter
- reacquire a fresh WebSocket ticket on every reconnect attempt
- reopen the backend WebSocket and resend the subscribe payload
- optionally resume from `resumeToken` or `sequence` when backend support exists
- escalate a prolonged reconnect failure clearly in the source widget UI and shared status surfaces

`streamStatus: "reconnecting"` therefore becomes an operational state backed by a real reconnect
loop, not just a semantic label.

## Scope

In scope:

- browser-to-backend WebSocket survivability for `connection-stream-query`
- reconnect triggers, backoff policy, and stale-stream detection
- ticket refresh on reconnect
- user-facing degraded-state visibility
- shared runtime-state semantics for disconnected vs reconnecting vs terminal error
- Explore stream test panel and source widget status parity

Out of scope:

- provider-side reconnect inside backend adapters
- changing downstream widget IO contracts
- making downstream widgets open their own WebSockets
- durable reconnect across full page reloads
- generic alert infrastructure for unrelated widgets

## Lifecycle Ownership

### Backend owns provider survivability

The backend adapter remains responsible for:

- reconnecting to provider sockets
- replay/resume against provider-specific protocols
- upstream subscription dedupe
- permission enforcement
- adapter-level backpressure and resource limits

### Frontend owns browser survivability

The frontend source runtime is responsible for:

- detecting that the browser socket to our backend died
- determining whether that failure is retryable
- reacquiring auth material for the next attempt
- reopening and resubscribing
- exposing clear lifecycle state to the user

We must not assume the backend alone can recover a dead browser WebSocket.

## Reconnect Triggers

The reconnect supervisor must treat these events as retry candidates unless explicitly marked
terminal:

1. socket `close` without an intentional local shutdown
2. socket `error`
3. retryable backend `error` message
4. heartbeat timeout
5. prolonged silence timeout when the stream contract expects activity

Intentional local shutdowns must never reconnect:

- widget unmount
- query/path/connection change that replaces the session
- explicit user stop/close action

## Supervisor Policy

### Attempt policy

- exponential backoff
- bounded max interval
- jitter to avoid reconnect stampedes
- reset the backoff after a stable live window

Representative policy:

- initial delay: short, for example 1 second
- capped maximum: moderate, for example 30 seconds
- optional failure escalation threshold by attempt count and/or elapsed disconnected time

This ADR does not hardcode exact numbers, but the implementation must choose explicit constants and
document them locally in the stream source README.

### Ticket refresh

Every reconnect attempt must acquire a fresh WebSocket ticket through the existing SPA ticket-auth
path before opening the new socket.

Do not reuse a possibly expired ticket from a prior attempt.

### Resume support

If the backend contract supports `resumeToken`, `sequence`, or equivalent resume semantics, the
frontend should send them on reconnect.

If resume is unavailable, the frontend still reconnects by opening a fresh subscription and
accepting a seed/snapshot reset.

Resume support is therefore an optimization, not a prerequisite for survivability.

## User-Facing State

The source widget and shared stream diagnostics must communicate degraded state clearly.

Required visible states:

- `connecting`
- `live`
- `reconnecting`
- `error`
- `closed`

Additional user-facing requirements:

- while reconnecting, keep the last good retained visible data on screen
- show the disconnect reason when known
- show last message / heartbeat timestamps
- show reconnect attempts and next retry timing in the stream test panel
- after repeated failures or prolonged disconnected time, surface a stronger warning than passive
  status text

This ADR does not require a global toast system. Inline source-widget and Explore-level alerting is
sufficient for the first implementation.

## Publication Semantics During Reconnect

Reconnect supervision must not invent a second consumer model.

Rules:

- source outputs remain `dataset` and `updates`
- downstream consumers continue reading the same contracts
- reconnecting does not clear retained visible state immediately
- a successful reconnect may publish:
  - a new `seed` reset
  - resumed `update` publications
  depending on backend resume support

The reconnect supervisor therefore changes source lifecycle and retry behavior, not downstream
widget contracts.

## Runtime-State Expectations

The source runtime must distinguish:

- `live`: socket open and stream healthy
- `reconnecting`: supervisor is actively retrying after a recoverable failure
- `error`: terminal failure or retry budget exhausted
- `closed`: intentional local stop or terminal remote completion

`reconnecting` must no longer be used as a purely cosmetic label after a retryable message if no
real reconnect attempt is being scheduled.

## Backend Contract Impact

Frontend reconnect supervision itself does not require a new backend route.

However, the following backend capabilities materially improve the implementation:

- resume token acceptance on subscribe
- sequence-aware replay or gap handling
- clear distinction between retryable and terminal errors
- heartbeat cadence guarantees

If the frontend implementation begins sending new subscribe fields, changes retry semantics, or
relies on resume behavior not already implemented server-side, that is a backend contract change and
must be coordinated with the backend ADRs above.

The first implementation can still proceed without mandatory backend changes by treating reconnect as
fresh subscribe with snapshot reset semantics.

## Implementation Plan

- [x] Add a reconnect supervisor to `createConnectionStreamQueryWidgetRuntimeSession(...)` instead
  of relying on one-shot socket open behavior.
- [x] Track intentional local shutdown separately from transport failure so cleanup does not
  reconnect.
- [x] Add heartbeat timeout detection based on stream metadata and actual message timestamps.
- [ ] Add separate prolonged-silence detection for stream contracts that do not advertise heartbeat
  cadence.
- [x] Reacquire a fresh WebSocket ticket on every reconnect attempt.
- [x] Add bounded exponential backoff with jitter and documented constants.
- [x] Keep last good retained visible data while reconnecting.
- [x] Expose reconnect attempt count, last disconnect reason, and next retry timing in runtime
  state or `source.context.stream`.
- [x] Show degraded-state alerting in:
  - [x] `ConnectionStreamQueryWidget.tsx`
  - [x] `ConnectionStreamQueryRailSummary.tsx`
  - [x] `ConnectionStreamQueryTestPanel.tsx`
- [x] Ensure reconnect does not create duplicate active subscriptions for one widget instance.
- [x] Ensure query/path/connection changes cancel old retries cleanly before starting the next
  session.
- [x] Ensure manual stop/close suppresses reconnect.
- [ ] Add tests for:
  - [x] retry after socket close
  - [ ] retry after socket error
  - [x] heartbeat timeout reconnect
  - [x] ticket refresh on reconnect
  - [ ] retry budget exhaustion to terminal error
  - [x] no reconnect after intentional close
  - [ ] no duplicate subscription after reconnect success
  - [x] retained visible state surviving reconnect

## Completion Notes

The reconnect runtime implementation is substantially in place:

- socket close, socket error, retryable backend error, heartbeat timeout, and subscription-start
  failure all enter the reconnect supervisor
- reconnect attempts reacquire SPA WebSocket ticket auth before opening a new backend socket
- retry uses bounded exponential backoff with jitter
- reconnect metadata is exposed through runtime state and shown in the widget, rail summary, and
  stream test panel
- cleanup and request changes clear reconnect/heartbeat timers and suppress reconnect

ADR 046 is not marked fully complete yet because several regression tests remain open. Those tests
must be added before the ADR is considered done.

## Acceptance Criteria

- [x] A recoverable browser-side socket close transitions a live source into real reconnect
  attempts without requiring widget remount.
- [x] A recoverable browser-side socket error does the same.
- [x] Missed heartbeat triggers reconnect.
- [ ] Stale-stream timeout without heartbeat metadata triggers reconnect.
- [x] Reconnect attempts reacquire fresh ticket auth before socket open.
- [x] The source widget keeps prior visible data while degraded and shows that the stream is not
  currently healthy.
- [x] After reconnect success, the widget returns to `live` and resumes normal publication.
- [x] After repeated failure or explicit terminal failure, the widget surfaces `error` with clear
  reason.
- [x] Downstream widgets require no transport-specific reconnect code.
