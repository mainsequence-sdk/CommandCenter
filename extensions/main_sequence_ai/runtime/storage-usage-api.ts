import { fetchMainSequenceAiAssistantResponse } from "./assistant-endpoint";

export interface StorageUsageSnapshot {
  version: number;
  root: string;
  totalBytes: number;
  availableBytes: number;
  filesystemUsedBytes: number;
  filesystemUsagePercent: number;
  consumedBytes: number;
  consumedPercentOfTotal: number;
  detail: {
    mainsequence: {
      bytes: number;
    };
    pi: {
      bytes: number;
    };
    astro: {
      bytes: number;
    };
    sessions: {
      bytes: number;
    };
    system: {
      bytes: number;
    };
  };
  capturedAt: string | null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStorageUsageSnapshot(payload: unknown): StorageUsageSnapshot {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Storage usage response was not an object.");
  }

  const candidate = payload as Record<string, unknown>;
  const detail =
    candidate.detail && typeof candidate.detail === "object" && !Array.isArray(candidate.detail)
      ? (candidate.detail as Record<string, unknown>)
      : {};

  const normalizeDetailBytes = (...keys: string[]) => {
    const entry = keys.map((key) => detail[key]).find(Boolean);

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return 0;
    }

    return normalizeNumber((entry as Record<string, unknown>).bytes);
  };

  return {
    version: normalizeNumber(candidate.version),
    root: normalizeString(candidate.root) ?? "",
    totalBytes: normalizeNumber(candidate.totalBytes),
    availableBytes: normalizeNumber(candidate.availableBytes),
    filesystemUsedBytes: normalizeNumber(candidate.filesystemUsedBytes),
    filesystemUsagePercent: normalizeNumber(candidate.filesystemUsagePercent),
    consumedBytes: normalizeNumber(candidate.consumedBytes),
    consumedPercentOfTotal: normalizeNumber(candidate.consumedPercentOfTotal),
    detail: {
      mainsequence: {
        bytes: normalizeDetailBytes("mainsequence", "mainSequence", "main_sequence"),
      },
      pi: {
        bytes: normalizeDetailBytes("pi"),
      },
      astro: {
        bytes: normalizeDetailBytes("astro"),
      },
      sessions: {
        bytes: normalizeDetailBytes("sessions"),
      },
      system: {
        bytes: normalizeDetailBytes("system"),
      },
    },
    capturedAt: normalizeString(candidate.capturedAt),
  };
}

export async function fetchStorageUsage({
  assistantEndpoint,
  signal,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    requestPath: "/api/storage/usage",
    method: "GET",
    signal,
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.detail ||
        payload?.error ||
        `Storage usage failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeStorageUsageSnapshot(payload);
}
