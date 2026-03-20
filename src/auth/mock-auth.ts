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

  const selectedRole: BuiltinAppRole = role ?? "admin";
  const normalizedEmail = identifier || `${selectedRole}@mainsequence.local`;
  const name = `${ROLE_LABELS[selectedRole]} User`;

  return {
    token: `dev-bypass-token-${selectedRole}`,
    tokenType: "Bearer",
    user: {
      id: `user-${selectedRole}`,
      name,
      email: normalizedEmail,
      team: selectedRole === "admin" ? "Platform" : "Workspace",
      role: selectedRole,
      permissions: ROLE_PERMISSIONS[selectedRole],
      groups: [ROLE_LABELS[selectedRole]],
      dateJoined: "2026-03-18T10:20:30Z",
      isActive: true,
      lastLogin: "2026-03-18T10:20:30Z",
      mfaEnabled: selectedRole === "admin",
      organizationTeams: [
        {
          id: selectedRole === "admin" ? 1 : 4,
          name: selectedRole === "admin" ? "Platform" : "Workspace",
          description:
            selectedRole === "admin"
              ? "Platform administration team"
              : "General non-admin workspace users",
          is_active: true,
        },
      ],
    },
  };
}
