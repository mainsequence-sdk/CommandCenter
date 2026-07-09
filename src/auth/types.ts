export const builtinAppRoles = ["user", "org_admin"] as const;

export type BuiltinAppRole = (typeof builtinAppRoles)[number];
export type AppRole = string;

export type Permission = string;
export type AuthMode = "jwt" | "runtime_credential";

export interface ShellAccess {
  accessibleApps: string[];
  accessibleSurfaces: string[];
}

export interface OrganizationTeam {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

export interface AppPlan {
  name: string;
  price?: number;
  description?: string;
  plan_type?: string;
}

export interface AppUser {
  id: string;
  uid?: string;
  name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatarUrl?: string;
  plan?: AppPlan;
  team: string;
  role: AppRole;
  organizationRole?: string;
  permissions: Permission[];
  shellAccess?: ShellAccess;
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
