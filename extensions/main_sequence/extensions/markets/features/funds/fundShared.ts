import { getAppPath } from "@/apps/utils";

export const mainSequenceVirtualFundUidParam = "msVirtualFundUid";
export const mainSequenceVirtualFundTabParam = "msVirtualFundTab";
export const defaultVirtualFundDetailTabId = "details";
export const virtualFundHoldingsTabId = "holdings";

export function getVirtualFundsListPath() {
  return getAppPath("main_sequence_markets", "funds");
}

export function getVirtualFundDetailPath(fundUid: string, tabId = defaultVirtualFundDetailTabId) {
  const searchParams = new URLSearchParams({
    [mainSequenceVirtualFundUidParam]: fundUid,
    [mainSequenceVirtualFundTabParam]: tabId,
  });

  return `${getVirtualFundsListPath()}?${searchParams.toString()}`;
}
