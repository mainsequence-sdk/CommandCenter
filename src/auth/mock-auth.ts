import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/auth/permissions";
import type { BuiltinAppRole, LoginInput, Session } from "@/auth/types";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function loginWithRole({
  identifier,
  role,
}: LoginInput): Promise<Session> {
  await sleep(250);

  const selectedRole: BuiltinAppRole = role ?? "org_admin";
  const normalizedEmail = identifier || `${selectedRole}@mainsequence.local`;
  const name = `${ROLE_LABELS[selectedRole]} User`;
  const isPlatformAdmin = selectedRole === "platform_admin";
  const organizationRole = selectedRole === "user" ? "USER" : "ORG_ADMIN";
  const groups =
    selectedRole === "platform_admin"
      ? ["Platform Admin", "Organization Admin"]
      : selectedRole === "org_admin"
        ? ["Organization Admin"]
        : ["User"];

  return {
    token: `dev-bypass-token-${selectedRole}`,
    tokenType: "Bearer",
    user: {
      id: `user-${selectedRole}`,
      name,
      email: normalizedEmail,
      team: selectedRole === "user" ? "Workspace" : "Platform",
      role: selectedRole,
      permissions: ROLE_PERMISSIONS[selectedRole],
      organizationRole,
      platformPermissions: isPlatformAdmin ? ["platform_admin:access"] : [],
      isPlatformAdmin,
      groups,
      dateJoined: "2026-03-18T10:20:30Z",
      isActive: true,
      lastLogin: "2026-03-18T10:20:30Z",
      mfaEnabled: selectedRole !== "user",
      organizationTeams: [
        {
          id: selectedRole === "user" ? 4 : 1,
          name: selectedRole === "user" ? "Workspace" : "Platform",
          description:
            selectedRole !== "user"
              ? "Platform administration team"
              : "General non-admin workspace users",
          is_active: true,
        },
      ],
    },
  };
}
