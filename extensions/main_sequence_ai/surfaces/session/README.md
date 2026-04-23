# Main Sequence AI Agent Session Surface

## Purpose

This directory owns the dedicated AgentSession detail page surface for the `Main Sequence AI` app.

It exists so AgentSession detail is its own screen, not a chat-owned modal. Chat, widgets, and
other Main Sequence AI surfaces can deep-link here when they need a full session shell.

## Entry Points

- `AgentSessionDetailPage.tsx`
  Route-driven page surface that reads `?session=<id>`, loads the shared AgentSession detail
  snapshot, renders the shared core-detail sections, and exposes the same provider/model PATCH flow
  used by chat.

## Dependencies

- `extensions/main_sequence_ai/agent-session-detail/`
  Shared AgentSession detail model, route helpers, reusable detail sections, insight sections, and
  model editor used by this independent page shell.
- `extensions/main_sequence_ai/runtime/`
  Backend session detail and assistant runtime transport for detail, insights, and model catalog
  loading.

## Maintenance Notes

- Keep the detail shell independent from `assistant-ui/ChatProvider.tsx`. This page must continue
  working even when opened outside chat.
- The route contract is query-based on purpose so widgets and rails can deep-link with only the
  backend session id.
