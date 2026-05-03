export const PUBLIC_WORKSPACE_RENDER_PERMISSIONS = ["workspaces:view"] as const;

export function clonePublicWorkspaceRenderPermissions(): string[] {
  return [...PUBLIC_WORKSPACE_RENDER_PERMISSIONS];
}
