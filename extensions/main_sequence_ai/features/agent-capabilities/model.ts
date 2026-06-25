import type {
  AgentCapabilityContentRecord,
  AgentCapabilityKind,
  AgentCapabilityRecord,
  AgentCapabilitySourceType,
} from "./api";

export const capabilityMarkdownMimeType = "text/markdown";

export interface AgentCapabilityResourceDraft {
  name: string;
  kind: AgentCapabilityKind;
  capabilityPath: string;
  description: string;
  metadataText: string;
  sourceType: AgentCapabilitySourceType;
  sourceRef: string;
}

export interface AgentCapabilityContentDraft {
  content: string;
  filename: string;
  contentMimeType: string;
}

export interface AgentCapabilityEditorDraft {
  resource: AgentCapabilityResourceDraft;
  content: AgentCapabilityContentDraft;
}

export interface AgentCapabilityDirtyState {
  resourceChanged: boolean;
  contentChanged: boolean;
  hasChanges: boolean;
}

function normalizePathInput(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}

export function slugifyCapabilityName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "new-capability";
}

function ensurePromptMarkdownFilename(value: string, fallbackName: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return `${fallbackName}.md`;
  }

  if (trimmed.toLowerCase().endsWith(".md") || trimmed.toLowerCase().endsWith(".markdown")) {
    return trimmed;
  }

  return `${trimmed}.md`;
}

export function normalizeCapabilityPath(
  kind: AgentCapabilityKind,
  capabilityPath: string,
  capabilityName = "",
) {
  const fallbackSlug = slugifyCapabilityName(capabilityName);
  const normalized = normalizePathInput(capabilityPath);

  if (kind === "skill") {
    if (!normalized) {
      return `skills/${fallbackSlug}/SKILL.md`;
    }

    const segments = normalized.split("/").filter(Boolean);

    if (segments.length === 0) {
      return `skills/${fallbackSlug}/SKILL.md`;
    }

    const lastSegment = segments[segments.length - 1]?.toLowerCase() ?? "";

    if (lastSegment === "skill.md") {
      segments[segments.length - 1] = "SKILL.md";
      return segments.join("/");
    }

    if (lastSegment.endsWith(".md") || lastSegment.endsWith(".markdown")) {
      segments[segments.length - 1] = "SKILL.md";
      return segments.join("/");
    }

    segments.push("SKILL.md");
    return segments.join("/");
  }

  if (!normalized) {
    return `prompts/${fallbackSlug}.md`;
  }

  const segments = normalized.split("/").filter(Boolean);

  if (segments.length === 0) {
    return `prompts/${fallbackSlug}.md`;
  }

  const filename = ensurePromptMarkdownFilename(
    segments.pop() ?? "",
    fallbackSlug,
  );

  return [...segments, filename].join("/");
}

export function deriveCapabilityFilename(
  kind: AgentCapabilityKind,
  capabilityPath: string,
  capabilityName = "",
) {
  if (kind === "skill") {
    return "SKILL.md";
  }

  const normalizedPath = normalizeCapabilityPath(kind, capabilityPath, capabilityName);
  const segments = normalizedPath.split("/").filter(Boolean);

  return segments[segments.length - 1] ?? `${slugifyCapabilityName(capabilityName)}.md`;
}

function stringifyMetadata(metadata: Record<string, unknown>) {
  return JSON.stringify(metadata, null, 2);
}

export function buildCapabilityEditorDraft({
  kind,
  capability,
  content,
}: {
  kind?: AgentCapabilityKind;
  capability?: AgentCapabilityRecord | null;
  content?: AgentCapabilityContentRecord | null;
}): AgentCapabilityEditorDraft {
  const resolvedKind = capability?.kind ?? kind ?? "skill";
  const resolvedName = capability?.name ?? "";
  const resolvedCapabilityPath = normalizeCapabilityPath(
    resolvedKind,
    capability?.capabilityPath ?? "",
    resolvedName,
  );

  return {
    resource: {
      name: resolvedName,
      kind: resolvedKind,
      capabilityPath: resolvedCapabilityPath,
      description: capability?.description ?? "",
      metadataText: stringifyMetadata(capability?.metadata ?? {}),
      sourceType: capability?.sourceType ?? "inline",
      sourceRef: capability?.sourceRef ?? "",
    },
    content: {
      content: content?.content ?? "",
      filename: deriveCapabilityFilename(resolvedKind, resolvedCapabilityPath, resolvedName),
      contentMimeType: capabilityMarkdownMimeType,
    },
  };
}

export function synchronizeCapabilityDraft(
  draft: AgentCapabilityEditorDraft,
): AgentCapabilityEditorDraft {
  const capabilityPath = normalizeCapabilityPath(
    draft.resource.kind,
    draft.resource.capabilityPath,
    draft.resource.name,
  );
  const filename = deriveCapabilityFilename(
    draft.resource.kind,
    capabilityPath,
    draft.resource.name,
  );

  return {
    resource: {
      ...draft.resource,
      capabilityPath,
    },
    content: {
      ...draft.content,
      filename,
      contentMimeType: capabilityMarkdownMimeType,
    },
  };
}

export function parseCapabilityMetadataText(metadataText: string) {
  const trimmed = metadataText.trim();

  if (!trimmed) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Metadata must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function buildCapabilityResourcePayload(draft: AgentCapabilityEditorDraft) {
  return {
    name: draft.resource.name.trim(),
    kind: draft.resource.kind,
    description: draft.resource.description.trim(),
    source_type: draft.resource.sourceType,
    source_ref: draft.resource.sourceRef.trim(),
    capability_path: normalizeCapabilityPath(
      draft.resource.kind,
      draft.resource.capabilityPath,
      draft.resource.name,
    ),
    metadata: parseCapabilityMetadataText(draft.resource.metadataText),
  };
}

export function buildCapabilityContentPayload(draft: AgentCapabilityEditorDraft) {
  const synchronizedDraft = synchronizeCapabilityDraft(draft);

  return {
    content: synchronizedDraft.content.content,
    filename: synchronizedDraft.content.filename,
    content_mime_type: capabilityMarkdownMimeType,
  };
}

function buildResourceFingerprint(draft: AgentCapabilityEditorDraft) {
  return JSON.stringify(buildCapabilityResourcePayload(draft));
}

function buildContentFingerprint(draft: AgentCapabilityEditorDraft) {
  return JSON.stringify(buildCapabilityContentPayload(draft));
}

export function getCapabilityDirtyState(
  initialDraft: AgentCapabilityEditorDraft,
  currentDraft: AgentCapabilityEditorDraft,
): AgentCapabilityDirtyState {
  const resourceChanged =
    buildResourceFingerprint(initialDraft) !== buildResourceFingerprint(currentDraft);
  const contentChanged =
    buildContentFingerprint(initialDraft) !== buildContentFingerprint(currentDraft);

  return {
    resourceChanged,
    contentChanged,
    hasChanges: resourceChanged || contentChanged,
  };
}
