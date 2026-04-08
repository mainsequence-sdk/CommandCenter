import { useAuthStore } from "@/auth/auth-store";
import { hasOrganizationAdminAccess } from "@/auth/permissions";

import type { TeamMemberRecord } from "./api";

export const teamPermissionsObjectUrl = "/user/api/team/";
export const teamsRegistryPath = "/app/access-rbac/teams";
export const teamBehaviorHighlights = [
  "Sharing an object to a team gives that team's members access to the object.",
  "Being a member of a team does not automatically grant access to the team object itself.",
  "Sharing a team object controls who can list, view, or edit the team record.",
  "Only Organization Administrators can add or remove team members from a team.",
];

export function formatTeamError(error: unknown) {
  return error instanceof Error ? error.message : "The team request failed.";
}

export function getTeamMemberName(
  member: Pick<TeamMemberRecord, "first_name" | "last_name" | "email"> & {
    username?: string;
  },
) {
  const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return member.username || member.email;
}

export function toggleId(current: number[], id: number) {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

export function getTeamDetailPath(teamId: number) {
  return `${teamsRegistryPath}/${teamId}`;
}

export function useCanManageTeamCrud() {
  const user = useAuthStore((state) => state.session?.user ?? null);

  return hasOrganizationAdminAccess(user);
}
