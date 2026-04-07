import {
  startDashboardRequestTrace,
  type DashboardRequestTraceMeta,
} from "@/dashboards/dashboard-request-trace";
import {
  fetchResourceReleaseExchangeLaunch,
  type ResourceReleaseExchangeLaunchResponse,
} from "../../../../extensions/main_sequence/common/api";

import type {
  AppComponentMainSequenceResourceReleaseRef,
  AppComponentWidgetProps,
} from "./appComponentModel";

const appComponentProxyPrefix = "/__app_component_proxy__";
const defaultLaunchLifetimeMs = 100_000;
const launchRefreshLeewayMs = 15_000;

interface CachedMainSequenceReleaseLaunch {
  releaseId: number;
  token: string;
  rpcUrl: string;
  fastApiId: string;
  expiresAtMs: number;
}

const cachedLaunches = new Map<number, CachedMainSequenceReleaseLaunch>();
const inFlightLaunches = new Map<number, Promise<CachedMainSequenceReleaseLaunch>>();

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function describeTransportStrategy(requestUrl: string) {
  const resolvedUrl = new URL(requestUrl);
  const proxied = import.meta.env.DEV && isLoopbackHostname(resolvedUrl.hostname);

  return {
    proxied,
    resolvedUrl,
    transportUrl: proxied
      ? `${appComponentProxyPrefix}?target=${encodeURIComponent(resolvedUrl.toString())}`
      : resolvedUrl.toString(),
  };
}

function buildMainSequenceReleaseTransportErrorMessage(
  releaseId: number,
  requestUrl: string,
  error: unknown,
) {
  const { proxied, resolvedUrl } = describeTransportStrategy(requestUrl);
  const originalMessage =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "The browser failed before receiving an HTTP response.";
  const transportMessage = import.meta.env.DEV
    ? proxied
      ? "The request went through the local AppComponent proxy because the target host is loopback."
      : "The public API request was sent directly from the browser, so browser CORS, TLS, DNS, or network policy can fail before the API returns an HTTP response."
    : "The public API request was sent directly from the browser to the release RPC URL.";

  return [
    `Could not reach ${resolvedUrl.toString()} for Main Sequence resource release ${releaseId}.`,
    "The request used the temporary exchange-launch token plus X-FastAPI-ID, not the session JWT.",
    transportMessage,
    `Browser error: ${originalMessage}`,
  ].join(" ");
}

function decodeBase64UrlJson(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeJwtExpiryMs(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  const parsed = decodeBase64UrlJson(payload);
  const exp = typeof parsed?.exp === "number" ? parsed.exp : Number(parsed?.exp);

  if (!Number.isFinite(exp) || exp <= 0) {
    return null;
  }

  return exp * 1000;
}

function deriveFastApiId(
  rpcUrl: string,
  fallbackSubdomain?: string,
) {
  try {
    const [firstLabel] = new URL(rpcUrl).hostname.split(".").filter(Boolean);

    if (firstLabel?.trim()) {
      return firstLabel.trim();
    }
  } catch {
    // Ignore and fall back to persisted subdomain.
  }

  return typeof fallbackSubdomain === "string" && fallbackSubdomain.trim()
    ? fallbackSubdomain.trim()
    : null;
}

function resolveExchangeLaunchUrl(
  release: AppComponentMainSequenceResourceReleaseRef,
) {
  const configuredUrl =
    typeof release.exchangeLaunchUrl === "string" && release.exchangeLaunchUrl.trim()
      ? release.exchangeLaunchUrl.trim()
      : "";

  if (configuredUrl) {
    return configuredUrl;
  }

  return `/orm/api/pods/resource-release/${release.releaseId}/exchange-launch/`;
}

function normalizeLaunchPayload(
  release: AppComponentMainSequenceResourceReleaseRef,
  payload: ResourceReleaseExchangeLaunchResponse,
) {
  if (payload.release_kind?.trim().toLowerCase() !== "fastapi") {
    throw new Error(
      `Resource release ${release.releaseId} is not a FastAPI launch target.`,
    );
  }

  if (payload.mode !== "token") {
    throw new Error(
      `Unexpected exchange-launch mode for resource release ${release.releaseId}: ${payload.mode}.`,
    );
  }

  const rpcUrl = new URL(payload.rpc_url).toString();
  const fastApiId = deriveFastApiId(rpcUrl, release.subdomain);

  if (!fastApiId) {
    throw new Error(
      `Could not derive X-FastAPI-ID for resource release ${release.releaseId}.`,
    );
  }

  return {
    releaseId: release.releaseId,
    token: payload.token,
    rpcUrl,
    fastApiId,
    expiresAtMs:
      decodeJwtExpiryMs(payload.token) ?? Date.now() + defaultLaunchLifetimeMs,
  } satisfies CachedMainSequenceReleaseLaunch;
}

function isCachedLaunchUsable(launch: CachedMainSequenceReleaseLaunch | undefined) {
  return Boolean(launch && launch.expiresAtMs - launchRefreshLeewayMs > Date.now());
}

async function fetchMainSequenceReleaseLaunch(
  release: AppComponentMainSequenceResourceReleaseRef,
) {
  try {
    return normalizeLaunchPayload(
      release,
      await fetchResourceReleaseExchangeLaunch(resolveExchangeLaunchUrl(release)),
    );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to get FastAPI launch token for resource release ${release.releaseId}. ${error.message}`
        : `Failed to get FastAPI launch token for resource release ${release.releaseId}.`,
    );
  }
}

async function resolveMainSequenceReleaseLaunch(
  release: AppComponentMainSequenceResourceReleaseRef,
  options?: {
    forceRefresh?: boolean;
  },
) {
  const cachedLaunch = cachedLaunches.get(release.releaseId);

  if (!options?.forceRefresh && isCachedLaunchUsable(cachedLaunch)) {
    return cachedLaunch!;
  }

  const inFlightLaunch = inFlightLaunches.get(release.releaseId);

  if (!options?.forceRefresh && inFlightLaunch) {
    return inFlightLaunch;
  }

  const requestPromise = (async () => {
    const nextLaunch = await fetchMainSequenceReleaseLaunch(release);
    cachedLaunches.set(release.releaseId, nextLaunch);
    return nextLaunch;
  })();

  inFlightLaunches.set(release.releaseId, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightLaunches.delete(release.releaseId);
  }
}

function resolveReleaseRequestUrl(
  rpcUrl: string,
  requestUrl: string,
) {
  const request = new URL(requestUrl);
  return new URL(`${request.pathname}${request.search}${request.hash}`, rpcUrl).toString();
}

async function executeReleaseRequest(
  release: AppComponentMainSequenceResourceReleaseRef,
  requestUrl: string,
  init: RequestInit | undefined,
  traceMeta: DashboardRequestTraceMeta | undefined,
) {
  async function execute(launch: CachedMainSequenceReleaseLaunch) {
    const finalUrl = resolveReleaseRequestUrl(launch.rpcUrl, requestUrl);
    const { transportUrl } = describeTransportStrategy(finalUrl);
    const headers = new Headers(init?.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    headers.set("Authorization", `Bearer ${launch.token}`);
    headers.set("X-FastAPI-ID", launch.fastApiId);

    const requestTrace = startDashboardRequestTrace(traceMeta, {
      method: init?.method,
      url: finalUrl,
    });

    try {
      const response = await fetch(transportUrl, {
        ...init,
        headers,
      });

      requestTrace?.finish({
        status: response.status,
        ok: response.ok,
      });
      return response;
    } catch (error) {
      const message = buildMainSequenceReleaseTransportErrorMessage(
        release.releaseId,
        finalUrl,
        error,
      );
      requestTrace?.fail(message);
      throw new Error(message);
    }
  }

  const initialLaunch = await resolveMainSequenceReleaseLaunch(release);
  let response = await execute(initialLaunch);

  if (response.status !== 401) {
    return response;
  }

  const refreshedLaunch = await resolveMainSequenceReleaseLaunch(release, {
    forceRefresh: true,
  });

  if (refreshedLaunch.token === initialLaunch.token) {
    return response;
  }

  response = await execute(refreshedLaunch);
  return response;
}

function resolveReleaseRef(
  props: Pick<AppComponentWidgetProps, "mainSequenceResourceRelease">,
) {
  const release = props.mainSequenceResourceRelease;

  if (!release?.releaseId) {
    throw new Error("Select a Main Sequence FastAPI resource release before sending requests.");
  }

  return release;
}

export function buildMainSequenceReleaseTransportIdentityKey(
  props: Pick<AppComponentWidgetProps, "mainSequenceResourceRelease">,
) {
  return props.mainSequenceResourceRelease?.releaseId
    ? `main-sequence-resource-release:${props.mainSequenceResourceRelease.releaseId}`
    : "main-sequence-resource-release:invalid";
}

export async function sendMainSequenceReleaseRequest(
  requestUrl: string,
  {
    props,
    init,
    traceMeta,
  }: {
    props: Pick<AppComponentWidgetProps, "mainSequenceResourceRelease">;
    init?: RequestInit;
    traceMeta?: DashboardRequestTraceMeta;
  },
) {
  const release = resolveReleaseRef(props);
  return executeReleaseRequest(release, requestUrl, init, traceMeta);
}
