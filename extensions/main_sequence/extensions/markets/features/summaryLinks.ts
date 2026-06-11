import { getAppPath } from "@/apps/utils";

function buildSearchPath(surfaceId: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `${getAppPath("main_sequence_markets", surfaceId)}?${searchParams.toString()}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readApiUrlResourceUid(linkUrl: string, resource: string) {
  const match = linkUrl
    .trim()
    .match(new RegExp(`/api/v1/${escapeRegExp(resource)}/([^/?#]+)/?`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

type PortfolioTableLinkTarget = "weights" | "signals_weights" | "portfolio_values";

function readApiUrlPortfolioTable(linkUrl: string) {
  const match = linkUrl
    .trim()
    .match(/\/api\/v1\/portfolio\/([^/?#]+)\/(weights|signals_weights|portfolio_values)\/?/);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    portfolioUid: decodeURIComponent(match[1]),
    table: match[2] as PortfolioTableLinkTarget,
  };
}

function readApiUrlCalendarRelationship(linkUrl: string) {
  const match = linkUrl
    .trim()
    .match(/\/api\/v1\/calendar\/([^/?#]+)\/(dates|sessions|events)\/?/);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    calendarUid: decodeURIComponent(match[1]),
    tab: match[2],
  };
}

function buildPortfolioPath(portfolioUid: string, tabId: string) {
  return buildSearchPath("portfolios", {
    msTargetPortfolioUid: portfolioUid,
    msTargetPortfolioTab: tabId,
  });
}

function buildCalendarPath(calendarUid: string, tabId = "details") {
  return buildSearchPath("calendars", {
    msCalendarUid: calendarUid,
    msCalendarTab: tabId,
  });
}

function buildAssetPath(assetUid: string) {
  return buildSearchPath("assets", {
    msAssetUid: assetUid,
    msAssetTab: "summary",
  });
}

function buildIndexPath(indexUid: string) {
  return buildSearchPath("indices", {
    msIndexUid: indexUid,
  });
}

function buildPricingCurvePath(curveUid: string) {
  return buildSearchPath("pricing-curves", {
    msPricingCurveUid: curveUid,
  });
}

function buildVirtualFundPath(fundUid: string) {
  return buildSearchPath("funds", {
    msVirtualFundUid: fundUid,
    msVirtualFundTab: "details",
  });
}

function buildPortfolioSignalPath(signalUid: string) {
  return buildSearchPath("portfolio-signals", {
    msPortfolioSignalUid: signalUid,
  });
}

export function resolveMainSequenceMarketsSummaryLinkPath(linkUrl: string) {
  const normalizedUrl = linkUrl.trim();

  if (!normalizedUrl) {
    return null;
  }

  if (normalizedUrl.startsWith("/app/")) {
    return normalizedUrl;
  }

  const portfolioTable = readApiUrlPortfolioTable(normalizedUrl);
  if (portfolioTable) {
    const tabByTable = {
      weights: "weights",
      signals_weights: "signal_weights",
      portfolio_values: "portfolio_values",
    } satisfies Record<PortfolioTableLinkTarget, string>;

    return buildPortfolioPath(portfolioTable.portfolioUid, tabByTable[portfolioTable.table]);
  }

  const calendarRelationship = readApiUrlCalendarRelationship(normalizedUrl);
  if (calendarRelationship) {
    return buildCalendarPath(calendarRelationship.calendarUid, calendarRelationship.tab);
  }

  const calendarUid = readApiUrlResourceUid(normalizedUrl, "calendar");
  if (calendarUid) {
    return buildCalendarPath(calendarUid);
  }

  const indexUid = readApiUrlResourceUid(normalizedUrl, "index");
  if (indexUid) {
    return buildIndexPath(indexUid);
  }

  const assetUid = readApiUrlResourceUid(normalizedUrl, "asset");
  if (assetUid) {
    return buildAssetPath(assetUid);
  }

  const categoryUid = readApiUrlResourceUid(normalizedUrl, "asset-category");
  if (categoryUid) {
    return `${getAppPath("main_sequence_markets", "asset-categories")}/${encodeURIComponent(categoryUid)}`;
  }

  const accountUid = readApiUrlResourceUid(normalizedUrl, "account");
  if (accountUid) {
    return `${getAppPath("main_sequence_markets", "accounts")}/${encodeURIComponent(accountUid)}`;
  }

  const fundUid = readApiUrlResourceUid(normalizedUrl, "virtualfund");
  if (fundUid) {
    return buildVirtualFundPath(fundUid);
  }

  const signalUid = readApiUrlResourceUid(normalizedUrl, "portfolio-signal");
  if (signalUid) {
    return buildPortfolioSignalPath(signalUid);
  }

  const curveUid = readApiUrlResourceUid(normalizedUrl, "pricing/curves");
  if (curveUid) {
    return buildPricingCurvePath(curveUid);
  }

  const portfolioUid = readApiUrlResourceUid(normalizedUrl, "portfolio");
  if (portfolioUid) {
    return buildPortfolioPath(portfolioUid, "detail");
  }

  return null;
}

export function openMainSequenceMarketsSummaryLink(
  navigate: (path: string) => void,
  linkUrl: string,
) {
  const appPath = resolveMainSequenceMarketsSummaryLinkPath(linkUrl);

  if (appPath) {
    navigate(appPath);
    return;
  }

  const normalizedUrl = linkUrl.trim();

  if (!normalizedUrl) {
    return;
  }

  window.open(normalizedUrl, "_blank", "noopener,noreferrer");
}
