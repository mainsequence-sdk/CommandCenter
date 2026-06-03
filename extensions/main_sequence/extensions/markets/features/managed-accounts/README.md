# Managed Accounts

This feature folder owns the first `Managed Accounts` section surface inside `Main Sequence Markets`.

## Purpose

- Render the `Accounts` registry as a standard list/detail Markets workflow.
- Keep managed-account navigation aligned with the existing markets registry surfaces instead of
  introducing a new shell or nested app pattern.

## Entry Points

- `MainSequenceManagedAccountsPage.tsx`: registry list with shared search, offset pagination, and
  delete actions for selected accounts.
- `MainSequenceManagedAccountDetailPage.tsx`: summary-driven detail page for one managed account,
  with `Holdings` and `Target Position` tabs.
- `managedAccountShared.ts`: route helpers and label/value formatting shared by list and detail.

## Maintenance Notes

- This feature currently assumes the managed-account list/detail endpoint shape exposed through
  `extensions/main_sequence/common/api/index.ts`:
  - list: `/api/v1/account/`
  - summary: `/api/v1/account/{uid}/summary/`
- The registry list intentionally stays narrow to the current list contract. It should only rely on:
  - `account_name` / `display_name`
  - `is_paper`
  - `account_is_active`
- Do not infer broker names, account numbers, account types, or other removed relationship labels from the list
  payload unless the backend contract explicitly adds them.
- The list surface also supports deleting selected accounts through:
  - `DELETE /api/v1/account/{uid}/`
- If the backend later adds edit flows or a dedicated bulk-delete account contract, keep them in
  this feature instead of overloading the shared API layer without a concrete UI contract.
- `Holdings` now mounts the positions widget directly with `sourceType: "account"`,
  `editableInPlace: true`, and the current `accountUid` inside the account detail page. That
  surface hydrates from:
  - `GET /api/v1/account/{uid}/holdings/`
  - latest snapshot semantics: `order=desc&limit=1`
- Holdings edits write back through:
  - `POST /api/v1/account/{uid}/add-holdings/`
- `Target Position` now mounts the same positions widget with `sourceType: "target_positions_account"`
  directly inside the account detail page. That
  surface hydrates from:
  - `GET /api/v1/account/{uid}/target-positions/`
  - latest assignment semantics: `order=desc&limit=1`
  and, when `targetPositionsDate` is set, requests that exact assignment timestamp.
  The read contract is uid-only: `positions[].asset` exposes `uid`, `unique_identifier`, and
  `current_snapshot.{name,ticker}`. Do not expect numeric asset ids or `figi` in this GET
  response.
  The same surface now persists through:
  - `POST /api/v1/account/{uid}/add-target-positions/`
  and stores the assignment datetime at the widget level as `targetPositionsDate`.
- Keep the detail view generic enough to tolerate additive backend fields, but do not silently
  infer destructive actions or edit semantics from arbitrary payload keys.
