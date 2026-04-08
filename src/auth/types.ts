export const builtinAppRoles = ["user", "org_admin", "platform_admin"] as const;

export type BuiltinAppRole = (typeof builtinAppRoles)[number];
export type AppRole = string;

export type Permission = string;

export interface OrganizationTeam {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatarUrl?: string;
  plan?: string;
  team: string;
  role: AppRole;
  organizationRole?: string;
  platformPermissions?: Permission[];
  isPlatformAdmin?: boolean;
  permissions: Permission[];
  groups?: string[];
  dateJoined?: string;
  isActive?: boolean;
  lastLogin?: string;
  mfaEnabled?: boolean;
  organizationTeams?: OrganizationTeam[];
}

export interface Session {
  token: string;
  tokenType?: string;
  expiresAt?: number;
  user: AppUser;
}

export interface LoginInput {
  identifier: string;
  password: string;
  role?: BuiltinAppRole;
}
