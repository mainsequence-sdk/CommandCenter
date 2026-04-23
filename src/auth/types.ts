export const builtinAppRoles = ["user", "org_admin", "platform_admin"] as const;

export type BuiltinAppRole = (typeof builtinAppRoles)[number];
export type AppRole = string;

export type Permission = string;
export type AuthMode = "jwt" | "runtime_credential";

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
  authMode?: AuthMode;
  user: AppUser;
}

export interface LoginInput {
  identifier: string;
  password: string;
  mfaCode?: string;
  role?: BuiltinAppRole;
}

export interface MfaSetupChallenge {
  detail: string;
  setupToken: string;
  setupUrl: string;
  setupVerifyUrl: string;
  qrPngBase64?: string;
  manualEntryKey?: string;
}

export type AuthLoginChallenge =
  | {
      type: "mfa_required";
      detail: string;
    }
  | ({
      type: "mfa_setup_required";
    } & MfaSetupChallenge);

export interface CompleteMfaSetupInput {
  setupToken: string;
  setupVerifyUrl: string;
  mfaCode: string;
}
