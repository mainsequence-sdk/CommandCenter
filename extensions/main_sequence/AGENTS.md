# Main Sequence App Standards

This `AGENTS.md` applies to everything under `extensions/main_sequence/`.

## Start With The Local Docs

- Read [README.md](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/README.md) before making structural changes in this app.
- Read the nearest nested-extension or `common/` README before changing ownership boundaries.
- Read the nearest feature `README.md` before changing a screen or adding a new flow.
- Treat the local README files as the first source of truth for module ownership, entrypoints, and maintenance boundaries.
- When you add a new feature folder or change ownership of a feature, update its local `README.md` in the same change.

## Default Screen Pattern

- Most Main Sequence surfaces follow the same base pattern:
  1. a row-based registry or list view for an object collection
  2. search and pagination on that list
  3. a detail flow for the selected row
- Keep new object screens aligned with that pattern unless there is a strong product reason not to.
- Prefer a single page component that owns both the list state and the selected-detail routing when that matches existing screens.
- Keep routing for selected rows URL-backed so detail views are linkable and refresh-safe.

## List View Standards

- Reuse the shared registry building blocks in `common/components/` whenever possible:
  - `MainSequenceRegistrySearch.tsx`
  - `MainSequenceRegistryPagination.tsx`
  - `registryTable.ts`
  - `MainSequenceSelectionCheckbox.tsx` when row selection is needed
- Prefer server-side search and server-side pagination when the backend supports them.
- Keep the table row layout visually consistent with the other object registries in this app.
- Treat the registry view as the canonical entrypoint for the object unless the feature explicitly needs a different shell.

## Detail View Standards

- Keep detail views consistent across objects.
- The detail header should come from the backend summary contract whenever the backend exposes it.
- Prefer object summary endpoints that follow the same summary request shape already used in this app, such as `/summary/` responses or equivalent summary payloads.
- Render summary-backed headers through `MainSequenceEntitySummaryCard.tsx` from `common/components/` so badges, inline fields, highlight fields, and stats stay consistent across objects.
- If a summary endpoint is not available yet, use a small fallback summary built from the list row, but keep the structure aligned with `EntitySummaryHeader` so it can be replaced cleanly later.
- Detail navigation should use the backend’s stable object identifier for that feature, which may be an integer id or a UUID.

## Feature Boundaries

- Keep feature-specific code inside its feature folder under the owning nested extension's `features/`.
- Move code into `common/components/`, `common/hooks/`, or `common/api/` only when it is reused across nested extensions or clearly meant to become a shared Main Sequence building block.
- Keep API transport logic, typed payloads, and endpoint helpers in `common/api/index.ts`. Page components should not call `fetch` directly.
- If a feature has object-specific tabs, dialogs, or editors, keep them in that feature folder unless they become broadly reusable.

## Consistency Rules

- Match existing naming and routing conventions for URL params, detail open/close handlers, and React Query keys.
- Keep read-only phases read-only. Do not add create, edit, or delete actions unless the feature scope explicitly includes them.
- When introducing a new object type, try to make its list, detail header, and navigation feel like the rest of the Main Sequence app rather than like a separate mini-app.

## Documentation Maintenance

- Keep this file aligned with the extension README files.
- Update this file when the shared screen pattern, summary contract, or ownership boundaries change materially.
