# Managed Accounts

This feature folder owns the first `Managed Accounts` section surface inside `Main Sequence Markets`.

## Purpose

- Render the `Accounts` registry as a standard list/detail Markets workflow.
- Support the first-pass create flow for managed accounts directly from the registry list.
- Keep managed-account navigation aligned with the existing markets registry surfaces instead of
  introducing a new shell or nested app pattern.

## Entry Points

- `MainSequenceManagedAccountsPage.tsx`: registry list with shared search, offset pagination, and
  account creation entry point.
- `MainSequenceManagedAccountDetailPage.tsx`: summary-driven detail page for one managed account,
  with `Holdings` and `Rebalance` tabs.
- `managedAccountShared.ts`: route helpers and label/value formatting shared by list and detail.
- `managedAccountEditor.tsx`: account creation dialog, option loading, validation, and payload
  shaping.

## Maintenance Notes

- This feature currently assumes the managed-account list/detail endpoint shape exposed through
  `extensions/main_sequence/common/api/index.ts`:
  - list: `/orm/api/assets/account/`
  - summary: `/orm/api/assets/account/{id}/summary/`
- The create flow assumes:
  - `POST /orm/api/assets/account/`
  - required payload fields: `account_name`, `execution_venue`
  - optional payload fields: `is_paper`, `valuation_translation_table`,
    `holdings_data_source`
- The create modal also depends on option loaders at:
  - `GET /orm/api/assets/execution_venue/`
  - `GET /orm/api/assets/asset-translation-tables/`
  - `GET /orm/api/connections/data_source/`
- Client-side validation treats `account_name` as unique and requires a holdings data source only
  when no organization default data source is visible in the loaded options payload.
- If the backend later adds edit or delete flows, keep them in this feature instead of overloading
  the shared API layer without a concrete UI contract.
- `Holdings` and `Rebalance` tabs are intentionally scaffolded UI surfaces. They need explicit
  backend-backed datasets before they should render real account content.
- Keep the detail view generic enough to tolerate additive backend fields, but do not silently
  infer destructive actions or edit semantics from arbitrary payload keys.
