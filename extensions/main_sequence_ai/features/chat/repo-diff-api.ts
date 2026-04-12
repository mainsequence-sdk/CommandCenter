export type RepoDiffFileStatus =
  | "added"
  | "copied"
  | "deleted"
  | "modified"
  | "renamed"
  | "typechange"
  | "unmerged"
  | "unknown"
  | "untracked";

export interface RepoDiffFile {
  path: string;
  originalPath: string | null;
  status: RepoDiffFileStatus;
  indexStatus: string | null;
  worktreeStatus: string | null;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface RepoDiffResponse {
  version: number;
  session: {
    sessionId: string;
    agentName: string;
    agentId: number | null;
    agentUniqueId: string | null;
    agentSessionId: string | null;
    projectId: string | null;
  };
  diff: {
    base: "HEAD" | "staged_and_worktree";
    hasChanges: boolean;
    patch: string;
    files: RepoDiffFile[];
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeNullableString(value: unknown) {
  const next = normalizeString(value);
  return next || null;
}

function normalizeNullableIdentifier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeNullableString(value);
}

function normalizeNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeRepoDiffFileStatus(value: unknown): RepoDiffFileStatus {
  switch (value) {
    case "added":
    case "copied":
    case "deleted":
    case "modified":
    case "renamed":
    case "typechange":
    case "unmerged":
    case "unknown":
    case "untracked":
      return value;
    default:
      return "unknown";
  }
}

function normalizeRepoDiffFile(value: unknown): RepoDiffFile | null {
  const candidate = asRecord(value);
  const path = normalizeString(candidate.path);

  if (!path) {
    return null;
  }

  return {
    path,
    originalPath: normalizeNullableString(candidate.originalPath),
    status: normalizeRepoDiffFileStatus(candidate.status),
    indexStatus: normalizeNullableString(candidate.indexStatus),
    worktreeStatus: normalizeNullableString(candidate.worktreeStatus),
    staged: candidate.staged === true,
    unstaged: candidate.unstaged === true,
    untracked: candidate.untracked === true,
  };
}

function normalizeRepoDiffResponse(payload: unknown) {
  const candidate = asRecord(payload);
  const session = asRecord(candidate.session);
  const diff = asRecord(candidate.diff);

  const files = Array.isArray(diff.files)
    ? diff.files.flatMap((entry) => {
        const normalized = normalizeRepoDiffFile(entry);
        return normalized ? [normalized] : [];
      })
    : [];

  const patch = typeof diff.patch === "string" ? diff.patch : "";

  return {
    version:
      typeof candidate.version === "number" && Number.isFinite(candidate.version)
        ? candidate.version
        : 1,
    session: {
      sessionId: normalizeString(session.sessionId),
      agentName: normalizeString(session.agentName),
      agentId: normalizeNullableNumber(session.agentId),
      agentUniqueId: normalizeNullableString(session.agentUniqueId),
      agentSessionId: normalizeNullableIdentifier(session.agentSessionId),
      projectId: normalizeNullableIdentifier(session.projectId),
    },
    diff: {
      base: diff.base === "staged_and_worktree" ? "staged_and_worktree" : "HEAD",
      hasChanges:
        typeof diff.hasChanges === "boolean"
          ? diff.hasChanges
          : files.length > 0 || patch.trim().length > 0,
      patch,
      files,
    },
  } satisfies RepoDiffResponse;
}

export async function fetchRepoDiff({
  url,
  signal,
  token,
  tokenType = "Bearer",
}: {
  url: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      payload?.message || payload?.error || `Repo diff failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeRepoDiffResponse(payload) satisfies RepoDiffResponse;
}
