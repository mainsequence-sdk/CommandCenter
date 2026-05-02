const PUBLIC_WORKSPACE_PATH_PREFIX = "/public/workspaces";

export function extractPublicWorkspaceToken(value: string | null | undefined) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/\/public\/workspaces\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    const match = value.match(/\/public\/workspaces\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}

export function buildPublicWorkspaceFrontendPath(token: string) {
  return `${PUBLIC_WORKSPACE_PATH_PREFIX}/${encodeURIComponent(token)}`;
}

export function buildPublicWorkspaceFrontendUrl(token: string, origin?: string) {
  if (!origin && typeof window !== "undefined") {
    return new URL(buildPublicWorkspaceFrontendPath(token), window.location.origin).toString();
  }

  if (origin) {
    return new URL(buildPublicWorkspaceFrontendPath(token), origin).toString();
  }

  return buildPublicWorkspaceFrontendPath(token);
}

export function buildPublicWorkspaceFrontendUrlFromBackendUrl(
  backendUrl: string | null | undefined,
  origin?: string,
) {
  const token = extractPublicWorkspaceToken(backendUrl);
  return token ? buildPublicWorkspaceFrontendUrl(token, origin) : null;
}
