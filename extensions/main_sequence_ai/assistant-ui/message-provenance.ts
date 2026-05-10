import type { ThreadMessageLike } from "@assistant-ui/react";

export interface MainSequenceAiMessageProvenance {
  origin: string;
  channel: string | null;
  callerAgentName: string | null;
  handleUniqueId: string | null;
  callerAgentSessionId: string | null;
  targetAgentId: string | null;
}

type ThreadMessageMetadata = ThreadMessageLike["metadata"];

const MAIN_SEQUENCE_AI_CUSTOM_METADATA_KEY = "mainSequenceAi";
export const MAIN_SEQUENCE_AI_PROVENANCE_DATA_PART = "main_sequence_ai_provenance";

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIdLikeString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeString(value);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeMessageProvenance(value: unknown): MainSequenceAiMessageProvenance | null {
  const candidate = asRecord(value);
  const origin = normalizeString(candidate.origin);

  if (!origin) {
    return null;
  }

  return {
    origin,
    channel: normalizeString(candidate.channel),
    callerAgentName: normalizeString(candidate.callerAgentName),
    handleUniqueId: normalizeString(candidate.handleUniqueId),
    callerAgentSessionId: normalizeIdLikeString(candidate.callerAgentSessionId),
    targetAgentId: normalizeIdLikeString(candidate.targetAgentId),
  };
}

export function buildMessageProvenanceMetadata(
  provenance: MainSequenceAiMessageProvenance,
): ThreadMessageMetadata {
  return {
    custom: {
      [MAIN_SEQUENCE_AI_CUSTOM_METADATA_KEY]: {
        provenance,
      },
    },
  };
}

export function buildMessageProvenanceDataPart(
  provenance: MainSequenceAiMessageProvenance,
) {
  return {
    type: `data-${MAIN_SEQUENCE_AI_PROVENANCE_DATA_PART}` as const,
    data: provenance,
  };
}

export function getMessageProvenanceFromMetadata(
  metadata: ThreadMessageMetadata | undefined,
): MainSequenceAiMessageProvenance | null {
  const custom = asRecord(metadata?.custom);
  const namespace = asRecord(custom[MAIN_SEQUENCE_AI_CUSTOM_METADATA_KEY]);
  return normalizeMessageProvenance(namespace.provenance);
}

export function isAgentOriginMessageMetadata(metadata: ThreadMessageMetadata | undefined) {
  return getMessageProvenanceFromMetadata(metadata)?.origin === "agent";
}

export function hasAgentOriginProvenancePart(parts: unknown) {
  if (!Array.isArray(parts)) {
    return false;
  }

  return parts.some((part) => {
    if (!part || typeof part !== "object" || Array.isArray(part)) {
      return false;
    }

    const candidate = part as Record<string, unknown>;
    return (
      candidate.type === "data" &&
      candidate.name === MAIN_SEQUENCE_AI_PROVENANCE_DATA_PART &&
      normalizeMessageProvenance(candidate.data)?.origin === "agent"
    );
  });
}
