# Chat Feature

## Purpose

This feature mounts a removable `assistant-ui` chat shell with two presentation modes that share one runtime:

- a full-page chat route at `/app/chat`
- a full-height frosted side rail that can sit on top of any surface rendered by `AppShell`

The current implementation is intentionally isolated so it can be removed later with minimal fallout in the main app.

## Integration Boundary

All chat-specific code lives under `src/features/chat/`.

Files outside this folder that are intentionally touched:

- `package.json`
- `package-lock.json`
- `src/app/layout/AppShell.tsx`
- `src/app/router.tsx`

Files intentionally not modified for this scaffold:

- `src/stores/shell-store.ts`
- `src/app/registry/index.ts`
- `src/auth/auth-store.ts`
- `src/data/live/rest-api.ts`
- shared UI primitives under `src/components/ui/`

That means the chat feature does not currently participate in:

- the extension registry
- the global shell Zustand store
- the existing live REST adapter layer

## Current Architecture

### ChatProvider

`ChatProvider.tsx` is the only place that knows about `assistant-ui` runtime wiring.

It currently uses `useExternalStoreRuntime` with feature-local state so the rest of the app does not need to adopt any new chat state conventions.

Responsibilities:

- own message/thread state for the scaffold
- expose overlay/page navigation helpers
- bridge app context into chat requests
- translate backend events into runtime state

### Backend Adapter

`chat-backend-adapter.ts` defines the feature-local transport contract.

Right now it uses a mock async event stream so the UI can be exercised without coupling the main app to a real agent transport yet.

When wiring your real backend, replace the mock implementation with:

- SSE consumption
- WebSocket consumption
- or any other async event source

Do not change the shell integration points for that step. Keep the transport swap inside this file.

### Context Bridge

`chat-context.ts` collects the currently visible app context:

- route path
- app and surface ids when available
- current user
- role
- permission count

This is deliberately read-only and local to the chat feature.

### Action Bridge

`chat-actions.ts` is the placeholder catalog for actions the assistant may eventually trigger.

The important rule is:

- chat-triggered mutations must call the same stores, query invalidations, and domain actions already used by the rest of the UI

Do not add a second mutation path that only chat uses.

## How It Is Mounted

### Shell Mount

`AppShell.tsx` wraps the shell in `ChatProvider` and renders `ChatMount`.

`ChatMount` is responsible for:

- overlay-only shell mounting
- keyboard shortcut handling
- rendering the overlay when open

The persistent visible trigger now lives in the sidebar chrome above the user menu/avatar instead of a floating bubble.

### Dedicated Route

`router.tsx` adds a dedicated child route:

- `/app/chat`

The route uses the same shared provider instance because the provider lives in `AppShell`.

## Removal

To remove this feature completely:

1. Delete `src/features/chat/`.
2. Remove `@assistant-ui/react` from `package.json`.
3. Remove the related entries from `package-lock.json`.
4. Remove the `ChatProvider` and `ChatMount` imports/usages from `src/app/layout/AppShell.tsx`.
5. Remove the `/app/chat` route from `src/app/router.tsx`.
6. Run `npm install` to refresh `node_modules` and the lockfile.

If you do those steps, the main project should return to its pre-chat shape because this scaffold does not alter:

- registry loading
- shell store structure
- auth store structure
- shared component contracts

## Next Integration Step

When you are ready to connect the real backend:

1. Replace the mock generator in `chat-backend-adapter.ts`.
2. Keep emitting the feature-local `ChatBackendEvent` events.
3. Extend the event mapping in `ChatProvider.tsx` if your backend streams richer parts such as reasoning or tool calls.
4. Move domain mutations into `chat-actions.ts` and reuse existing UI action paths.

That keeps the chat feature detachable while still allowing the backend bridge to get richer over time.
