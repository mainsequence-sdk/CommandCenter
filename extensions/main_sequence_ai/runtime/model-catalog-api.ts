import {
  buildMainSequenceAiAssistantHeaders,
  buildMainSequenceAiAssistantUrl,
} from "./assistant-endpoint";

export type ModelCatalogAuthKind = "api_key" | "oauth";
export type ModelCatalogReasoningEffort =
  | "off"
  | "on"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export interface ModelCatalogItem {
  source: string;
  provider: string;
  label: string;
  model: string;
  available: true;
  auth?:
    | {
        required: true;
        authKind: ModelCatalogAuthKind;
        signInAvailable: boolean;
        authenticated: boolean;
        usable: boolean;
        authSource: "runtime_store" | null;
      }
    | {
        required: false;
        authenticated: true;
        usable: true;
      };
  defaults: {
    runConfig: {
      reasoning_effort: ModelCatalogReasoningEffort;
    };
  };
  capabilities: {
    features?: string[];
    runConfig: {
      reasoning_effort: {
        supported: boolean;
        mode: "unsupported" | "toggle" | "levels";
        values: ModelCatalogReasoningEffort[];
        default: ModelCatalogReasoningEffort;
      };
    };
  };
  metadata?: Record<string, unknown>;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeReasoningEffort(value: unknown): ModelCatalogReasoningEffort {
  switch (value) {
    case "off":
    case "on":
    case "minimal":
    case "low":
    case "medium":
    case "high":
    case "xhigh":
      return value;
    default:
      return "medium";
  }
}

function normalizeAuthKind(value: unknown): ModelCatalogAuthKind {
  return value === "oauth" ? "oauth" : "api_key";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeAuth(value: unknown): ModelCatalogItem["auth"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const required = normalizeBoolean(candidate.required);

  if (!required) {
    return {
      required: false,
      authenticated: true,
      usable: true,
    };
  }

  return {
    required: true,
    authKind: normalizeAuthKind(candidate.authKind ?? candidate.auth_kind),
    signInAvailable: normalizeBoolean(candidate.signInAvailable ?? candidate.sign_in_available),
    authenticated: normalizeBoolean(candidate.authenticated),
    usable: normalizeBoolean(candidate.usable),
    authSource: (normalizeString(candidate.authSource ?? candidate.auth_source) as "runtime_store" | null) ?? null,
  };
}

function normalizeModelCatalogItem(value: unknown): ModelCatalogItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const source = normalizeString(candidate.source);
  const provider = normalizeString(candidate.provider);
  const model = normalizeString(candidate.model);
  const label = normalizeString(candidate.label) ?? model;

  if (!source || !provider || !model || !label) {
    return null;
  }

  const defaultsCandidate =
    candidate.defaults && typeof candidate.defaults === "object" && !Array.isArray(candidate.defaults)
      ? (candidate.defaults as Record<string, unknown>)
      : null;
  const defaultRunConfig =
    defaultsCandidate?.runConfig &&
    typeof defaultsCandidate.runConfig === "object" &&
    !Array.isArray(defaultsCandidate.runConfig)
      ? (defaultsCandidate.runConfig as Record<string, unknown>)
      : null;

  const capabilitiesCandidate =
    candidate.capabilities && typeof candidate.capabilities === "object" && !Array.isArray(candidate.capabilities)
      ? (candidate.capabilities as Record<string, unknown>)
      : null;
  const capabilityRunConfig =
    capabilitiesCandidate?.runConfig &&
    typeof capabilitiesCandidate.runConfig === "object" &&
    !Array.isArray(capabilitiesCandidate.runConfig)
      ? (capabilitiesCandidate.runConfig as Record<string, unknown>)
      : null;
  const reasoningCapability =
    capabilityRunConfig?.reasoning_effort &&
    typeof capabilityRunConfig.reasoning_effort === "object" &&
    !Array.isArray(capabilityRunConfig.reasoning_effort)
      ? (capabilityRunConfig.reasoning_effort as Record<string, unknown>)
      : null;

  return {
    source,
    provider,
    label,
    model,
    available: true,
    auth: normalizeAuth(candidate.auth),
    defaults: {
      runConfig: {
        reasoning_effort: normalizeReasoningEffort(
          defaultRunConfig?.reasoning_effort,
        ),
      },
    },
    capabilities: {
      features: normalizeStringArray(capabilitiesCandidate?.features),
      runConfig: {
        reasoning_effort: {
          supported: normalizeBoolean(reasoningCapability?.supported),
          mode:
            reasoningCapability?.mode === "unsupported" ||
            reasoningCapability?.mode === "toggle" ||
            reasoningCapability?.mode === "levels"
              ? reasoningCapability.mode
              : "unsupported",
          values: normalizeStringArray(reasoningCapability?.values).map((entry) =>
            normalizeReasoningEffort(entry),
          ),
          default: normalizeReasoningEffort(reasoningCapability?.default),
        },
      },
    },
    metadata:
      candidate.metadata && typeof candidate.metadata === "object" && !Array.isArray(candidate.metadata)
        ? (candidate.metadata as Record<string, unknown>)
        : undefined,
  };
}

function normalizeModelCatalogPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => normalizeModelCatalogItem(entry))
      .filter((entry): entry is ModelCatalogItem => Boolean(entry));
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as Record<string, unknown>;

  for (const key of ["catalog", "models", "items", "results", "data"]) {
    if (Array.isArray(candidate[key])) {
      return (candidate[key] as unknown[])
        .map((entry) => normalizeModelCatalogItem(entry))
        .filter((entry): entry is ModelCatalogItem => Boolean(entry));
    }
  }

  const singleEntry = normalizeModelCatalogItem(candidate);
  return singleEntry ? [singleEntry] : [];
}

function buildModelCatalogUrl(assistantEndpoint: string) {
  return buildMainSequenceAiAssistantUrl(assistantEndpoint, "/api/models/catalog");
}

export async function fetchModelCatalog({
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
  const response = await fetch(buildModelCatalogUrl(assistantEndpoint), {
    method: "GET",
    headers: buildMainSequenceAiAssistantHeaders({
      accept: "application/json",
      token,
      tokenType,
    }),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.detail ||
        payload?.error ||
        `Model catalog failed with status ${response.status}.`,
    );
  }

  return normalizeModelCatalogPayload((await response.json()) as unknown);
}
