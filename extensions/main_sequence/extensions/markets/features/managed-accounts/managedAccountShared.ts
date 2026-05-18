import { getAppPath } from "@/apps/utils";

import type { ManagedAccountRecord } from "../../../../common/api";

export function getManagedAccountsListPath() {
  return getAppPath("main_sequence_markets", "accounts");
}

export function getManagedAccountDetailPath(accountId: number) {
  return `${getManagedAccountsListPath()}/${accountId}`;
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
    (typeof account?.id === "number" ? `Account ${account.id}` : "Managed account")
  );
}

export function getManagedAccountSubtitle(account?: ManagedAccountRecord | null) {
  if (account?.execution_venue != null && String(account.execution_venue).trim()) {
    return `Execution venue ${String(account.execution_venue).trim()}`;
  }

  return "";
}
