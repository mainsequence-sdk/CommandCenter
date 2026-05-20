import { getAppPath } from "@/apps/utils";

import type { ManagedAccountRecord } from "../../../../common/api";

export function getManagedAccountsListPath() {
  return getAppPath("main_sequence_markets", "accounts");
}

export function getManagedAccountDetailPath(accountUid: string) {
  return `${getManagedAccountsListPath()}/${encodeURIComponent(accountUid)}`;
}

export function formatManagedAccountValue(
  value: string | null | undefined,
  fallback = "Not available",
) {
  const normalized = value?.trim();

  return normalized || fallback;
}

export function getManagedAccountTitle(account?: ManagedAccountRecord | null) {
  return (
    account?.display_name?.trim() ||
    account?.account_name?.trim() ||
    account?.name?.trim() ||
    "Managed account"
  );
}
