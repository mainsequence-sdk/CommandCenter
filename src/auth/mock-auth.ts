import { ROLE_LABELS } from "@/auth/permissions";
import { getMockShellAccessForRole } from "@/auth/mock-shell-access";
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
  const organizationRole = selectedRole === "user" ? "USER" : "ORG_ADMIN";

  return {
    token: `dev-bypass-token-${selectedRole}`,
    tokenType: "Bearer",
    user: {
      id: `user-${selectedRole}`,
      uid: `mock-user-uid-${selectedRole}`,
      name,
      email: normalizedEmail,
      team: selectedRole === "user" ? "Workspace" : "Administration",
      role: selectedRole,
      permissions: [],
      shellAccess: getMockShellAccessForRole(selectedRole),
      organizationRole,
      dateJoined: "2026-03-18T10:20:30Z",
      isActive: true,
      lastLogin: "2026-03-18T10:20:30Z",
      mfaEnabled: selectedRole !== "user",
      organizationTeams: [
        {
          id: selectedRole === "user" ? 4 : 1,
          name: selectedRole === "user" ? "Workspace" : "Administration",
          description:
            selectedRole !== "user"
              ? "Organization administration team"
              : "General non-admin workspace users",
          is_active: true,
        },
      ],
    },
  };
}
