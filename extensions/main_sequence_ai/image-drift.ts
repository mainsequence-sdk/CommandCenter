import type { AgentImageDriftRecord } from "./agent-search";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const AGENT_RUNTIME_IMAGE_DRIFT_NOTICE =
  "Your agent needs an update to keep working properly.";

export function normalizeAgentImageDriftRecord(value: unknown): AgentImageDriftRecord | null {
  const candidate = asRecord(value);

  if (!candidate) {
    return null;
  }

  const checks = Array.isArray(candidate.checks)
    ? candidate.checks
        .map((entry) => {
          const check = asRecord(entry);

          if (!check) {
            return null;
          }

          return {
            key: normalizeString(check.key),
            label: normalizeString(check.label),
            status: normalizeString(check.status),
            matches: typeof check.matches === "boolean" ? check.matches : null,
            has_drift: check.has_drift === true,
            reason: normalizeString(check.reason),
            expected_image_uri: normalizeString(check.expected_image_uri),
            actual_image_uri: normalizeString(check.actual_image_uri),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : null;

  return {
    agent_kind: normalizeString(candidate.agent_kind),
    available: candidate.available === true,
    has_drift: candidate.has_drift === true,
    checks,
    detail: normalizeString(candidate.detail),
  };
}

export function shouldShowAgentRuntimeImageDriftWarning(
  imageDrift: AgentImageDriftRecord | null | undefined,
) {
  if (!imageDrift) {
    return false;
  }

  if (imageDrift.has_drift === true) {
    return true;
  }

  return imageDrift.available === false && Boolean(imageDrift.detail?.trim());
}
