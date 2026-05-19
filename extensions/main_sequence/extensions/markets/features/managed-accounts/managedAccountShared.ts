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

function readExecutionVenueObjectLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const record = value as Record<string, unknown>;
  const candidates = [
    record.name,
    record.display_name,
    record.symbol,
    record.text,
    record.uid,
    record.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return "";
}

export function getManagedAccountExecutionVenueLabel(account?: ManagedAccountRecord | null) {
  const executionVenueName =
    typeof account?.execution_venue_name === "string" ? account.execution_venue_name.trim() : "";

  if (executionVenueName) {
    return executionVenueName;
  }

  const objectLabel = readExecutionVenueObjectLabel(account?.execution_venue);
  if (objectLabel) {
    return objectLabel;
  }

  if (account?.execution_venue != null && String(account.execution_venue).trim()) {
    return String(account.execution_venue).trim();
  }

  return "";
}

export function getManagedAccountTitle(account?: ManagedAccountRecord | null) {
  return (
    account?.display_name?.trim() ||
    account?.account_name?.trim() ||
    account?.name?.trim() ||
    "Managed account"
  );
}

export function getManagedAccountSubtitle(account?: ManagedAccountRecord | null) {
  const executionVenueLabel = getManagedAccountExecutionVenueLabel(account);
  if (executionVenueLabel) {
    return `Execution venue ${executionVenueLabel}`;
  }

  return "";
}
