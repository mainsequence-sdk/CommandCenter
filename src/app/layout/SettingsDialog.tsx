import { type ReactNode, useEffect, useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { CircleUserRound, FileCode2, Info, Settings2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { requestPasswordChangeEmail } from "@/auth/api";
import { useToast } from "@/components/ui/toaster";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getAccessProfileLabel } from "@/auth/permissions";
import type { CommandCenterConfig } from "@/config/command-center";
import { commandCenterConfigSource } from "@/config/command-center";
import { env } from "@/config/env";
import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";
import { defaultLanguage, isSupportedLanguage, languageOptions } from "@/i18n/config";
import type { AppUser } from "@/auth/types";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

interface SettingsDialogProps {
  mode: "platform" | "user";
  onClose: () => void;
  open: boolean;
  user?: AppUser;
}

type SettingsSectionId = "general" | "account" | "auth" | "configuration" | "about";

function resolveSettingsUrl(baseUrl: string, path: string) {
  if (!path) {
    return baseUrl;
  }

  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function SettingsRow({
  label,
  description,
  value,
}: {
  label: string;
  description?: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <div className="text-sm font-medium text-topbar-foreground">{label}</div>
        {description ? (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="shrink-0 text-sm text-foreground sm:max-w-[320px] sm:text-right">
        {value}
      </div>
    </div>
  );
}

function SettingsNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Settings2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-[calc(var(--radius)-4px)] px-3 py-2.5 text-left text-sm transition-colors",
        active
          ? "bg-white/[0.08] text-topbar-foreground"
          : "text-muted-foreground hover:bg-white/[0.04] hover:text-topbar-foreground",
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-6 border-b border-white/8 pb-4">
        <div className="text-lg font-semibold text-topbar-foreground">{title}</div>
        {description ? (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="divide-y divide-white/8">{children}</div>
    </section>
  );
}

function SettingsCodeBlock({
  value,
}: {
  value: string;
}) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-[calc(var(--radius)-6px)] border border-white/8 bg-black/20 p-4 text-left font-mono text-xs leading-6 text-topbar-foreground">
      <code>{value}</code>
    </pre>
  );
}

interface SettingsConfigFieldSpec {
  label: string;
  value: string;
  description?: string;
  monospace?: boolean;
  multiline?: boolean;
}

interface SettingsConfigGroupSpec {
  title: string;
  description?: string;
  fields: SettingsConfigFieldSpec[];
}

function SettingsConfigField({
  label,
  value,
  description,
  monospace = false,
  multiline = false,
}: SettingsConfigFieldSpec) {
  const sharedClassName = cn(
    "bg-black/20",
    monospace ? "font-mono text-xs" : undefined,
  );

  return (
    <div className="space-y-2 rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.02] p-3">
      <div>
        <div className="text-sm font-medium text-topbar-foreground">{label}</div>
        {description ? (
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {multiline ? (
        <Textarea readOnly value={value} className={cn("min-h-[104px] resize-y", sharedClassName)} />
      ) : (
        <Input readOnly value={value} className={sharedClassName} />
      )}
    </div>
  );
}

function SettingsConfigGroup({
  title,
  description,
  fields,
}: SettingsConfigGroupSpec) {
  return (
    <section className="rounded-[calc(var(--radius)-2px)] border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-4">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-topbar-foreground/80">
          {title}
        </div>
        {description ? (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {fields.map((field) => (
          <SettingsConfigField key={`${title}-${field.label}`} {...field} />
        ))}
      </div>
    </section>
  );
}

function buildConfigurationGroups({
  config,
  authTokenUrl,
  authRefreshUrl,
  authUserDetailsUrl,
}: {
  config: CommandCenterConfig;
  authTokenUrl: string;
  authRefreshUrl: string;
  authUserDetailsUrl: string;
}): SettingsConfigGroupSpec[] {
  const {
    accessRbac,
    app,
    auth,
    branding,
    commandCenterAccess,
    mainSequence,
    notifications,
    preferences,
    workspaces,
  } = config;

  return [
    {
      title: "App",
      description: "Shell identity and global refresh timings loaded from the bundled config.",
      fields: [
        { label: "Application name", value: app.name },
        { label: "Short name", value: app.shortName },
        {
          label: "Notifications refresh interval",
          value: `${app.notificationsRefreshIntervalMs} ms`,
          monospace: true,
        },
      ],
    },
    {
      title: "Branding",
      description: "Resolved branding assets and display labels used across the shell.",
      fields: [
        { label: "Light logo source", value: branding.logoLightmodeSrc, monospace: true },
        { label: "Dark logo source", value: branding.logoDarkmodeSrc, monospace: true },
        { label: "Logo mark source", value: branding.logoMarkSrc, monospace: true },
        { label: "Logo alt text", value: branding.logoAlt },
        { label: "Monogram", value: branding.monogram },
      ],
    },
    {
      title: "Preferences API",
      description: "Endpoints used for user preference and favorites persistence.",
      fields: [
        { label: "Preferences URL", value: preferences.url, monospace: true },
        { label: "Favorites create URL", value: preferences.favoritesCreateUrl, monospace: true },
        {
          label: "Favorites reorder URL",
          value: preferences.favoritesReorderUrl,
          monospace: true,
        },
        {
          label: "Favorites delete URL",
          value: preferences.favoritesDeleteUrl,
          monospace: true,
        },
      ],
    },
    {
      title: "Workspaces API",
      description: "Workspace list and detail routes used by the dashboard studio.",
      fields: [
        { label: "Workspace list URL", value: workspaces.listUrl, monospace: true },
        { label: "Workspace detail URL", value: workspaces.detailUrl, monospace: true },
      ],
    },
    {
      title: "Auth Identity",
      description: "High-level login configuration. Relative auth endpoints resolve against the runtime API base URL.",
      fields: [
        { label: "API base URL", value: env.apiBaseUrl, monospace: true },
        { label: "Identifier label", value: auth.identifierLabel },
        { label: "Identifier placeholder", value: auth.identifierPlaceholder },
      ],
    },
    {
      title: "JWT Endpoints",
      description: "Resolved authentication endpoints built from the configured base URL.",
      fields: [
        { label: "Token endpoint", value: authTokenUrl, monospace: true },
        { label: "Refresh endpoint", value: authRefreshUrl, monospace: true },
        { label: "User details endpoint", value: authUserDetailsUrl, monospace: true },
      ],
    },
    {
      title: "JWT Request Fields",
      description: "Payload field names expected by the token and refresh endpoints.",
      fields: [
        {
          label: "Identifier field",
          value: auth.jwt.requestFields.identifier,
          monospace: true,
        },
        { label: "Password field", value: auth.jwt.requestFields.password, monospace: true },
        { label: "Refresh field", value: auth.jwt.requestFields.refresh, monospace: true },
      ],
    },
    {
      title: "JWT Response Fields",
      description: "Response keys used to extract the access token, refresh token, and type.",
      fields: [
        {
          label: "Access token field",
          value: auth.jwt.responseFields.accessToken,
          monospace: true,
        },
        {
          label: "Refresh token field",
          value: auth.jwt.responseFields.refreshToken,
          monospace: true,
        },
        { label: "Token type field", value: auth.jwt.responseFields.tokenType, monospace: true },
      ],
    },
    {
      title: "JWT Claim Mapping",
      description: "JWT claim names mapped into the shell user model after sign-in.",
      fields: [
        { label: "User ID claim", value: auth.jwt.claimMapping.userId, monospace: true },
        { label: "Name claim", value: auth.jwt.claimMapping.name, monospace: true },
        { label: "Email claim", value: auth.jwt.claimMapping.email, monospace: true },
        { label: "Team claim", value: auth.jwt.claimMapping.team, monospace: true },
        { label: "Role claim", value: auth.jwt.claimMapping.role, monospace: true },
        {
          label: "Organization role claim",
          value: auth.jwt.claimMapping.organizationRole,
          monospace: true,
        },
        {
          label: "Permissions claim",
          value: auth.jwt.claimMapping.permissions,
          monospace: true,
        },
        {
          label: "Platform permissions claim",
          value: auth.jwt.claimMapping.platformPermissions,
          monospace: true,
        },
        {
          label: "Platform admin flag claim",
          value: auth.jwt.claimMapping.isPlatformAdmin,
          monospace: true,
        },
        {
          label: "Date joined claim",
          value: auth.jwt.claimMapping.dateJoined,
          monospace: true,
        },
        { label: "Active flag claim", value: auth.jwt.claimMapping.isActive, monospace: true },
        { label: "Last login claim", value: auth.jwt.claimMapping.lastLogin, monospace: true },
        {
          label: "MFA enabled claim",
          value: auth.jwt.claimMapping.mfaEnabled,
          monospace: true,
        },
        {
          label: "Organization teams claim",
          value: auth.jwt.claimMapping.organizationTeams,
          monospace: true,
        },
      ],
    },
    {
      title: "User Details Mapping",
      description: "Field mapping for the user-details endpoint and the backend-owned admin access contract.",
      fields: [
        { label: "User details URL", value: auth.jwt.userDetails.url, monospace: true },
        {
          label: "User ID response field",
          value: auth.jwt.userDetails.responseMapping.userId,
          monospace: true,
        },
        {
          label: "Name response field",
          value: auth.jwt.userDetails.responseMapping.name,
          monospace: true,
        },
        {
          label: "Email response field",
          value: auth.jwt.userDetails.responseMapping.email,
          monospace: true,
        },
        {
          label: "Team response field",
          value: auth.jwt.userDetails.responseMapping.team,
          monospace: true,
        },
        {
          label: "Role response field",
          value: auth.jwt.userDetails.responseMapping.role,
          monospace: true,
        },
        {
          label: "Organization role response field",
          value: auth.jwt.userDetails.responseMapping.organizationRole,
          monospace: true,
        },
        {
          label: "Permissions response field",
          value: auth.jwt.userDetails.responseMapping.permissions,
          monospace: true,
        },
        {
          label: "Platform permissions response field",
          value: auth.jwt.userDetails.responseMapping.platformPermissions,
          monospace: true,
        },
        {
          label: "Platform admin flag response field",
          value: auth.jwt.userDetails.responseMapping.isPlatformAdmin,
          monospace: true,
        },
        {
          label: "Date joined response field",
          value: auth.jwt.userDetails.responseMapping.dateJoined,
          monospace: true,
        },
        {
          label: "Active flag response field",
          value: auth.jwt.userDetails.responseMapping.isActive,
          monospace: true,
        },
        {
          label: "Last login response field",
          value: auth.jwt.userDetails.responseMapping.lastLogin,
          monospace: true,
        },
        {
          label: "MFA enabled response field",
          value: auth.jwt.userDetails.responseMapping.mfaEnabled,
          monospace: true,
        },
        {
          label: "Organization teams response field",
          value: auth.jwt.userDetails.responseMapping.organizationTeams,
          monospace: true,
        },
      ],
    },
    {
      title: "Access RBAC",
      description: "RBAC endpoints used by the admin tools to browse users.",
      fields: [
        { label: "Users list URL", value: accessRbac.users.listUrl, monospace: true },
      ],
    },
    {
      title: "Command Center Access",
      description:
        "Dedicated endpoints for reusable shell policies and per-user shell-access assignments.",
      fields: [
        {
          label: "Access policies list URL",
          value: commandCenterAccess.accessPolicies.listUrl,
          monospace: true,
        },
        {
          label: "Access policies detail URL",
          value: commandCenterAccess.accessPolicies.detailUrl,
          monospace: true,
        },
        {
          label: "User shell access URL",
          value: commandCenterAccess.users.shellAccessUrl,
          monospace: true,
        },
        {
          label: "User shell access preview URL",
          value: commandCenterAccess.users.shellAccessPreviewUrl,
          monospace: true,
        },
      ],
    },
    {
      title: "Main Sequence",
      description: "Main Sequence pod endpoint plus the permission route suffixes used by admin flows.",
      fields: [
        { label: "Endpoint", value: mainSequence.endpoint, monospace: true },
        {
          label: "Candidate users suffix",
          value: mainSequence.permissions.candidateUsersSuffix,
          monospace: true,
        },
        {
          label: "Can view suffix",
          value: mainSequence.permissions.canViewSuffix,
          monospace: true,
        },
        {
          label: "Can edit suffix",
          value: mainSequence.permissions.canEditSuffix,
          monospace: true,
        },
        {
          label: "Add to view suffix",
          value: mainSequence.permissions.addToViewSuffix,
          monospace: true,
        },
        {
          label: "Add to edit suffix",
          value: mainSequence.permissions.addToEditSuffix,
          monospace: true,
        },
        {
          label: "Remove from view suffix",
          value: mainSequence.permissions.removeFromViewSuffix,
          monospace: true,
        },
        {
          label: "Remove from edit suffix",
          value: mainSequence.permissions.removeFromEditSuffix,
          monospace: true,
        },
        {
          label: "Add team to view suffix",
          value: mainSequence.permissions.addTeamToViewSuffix,
          monospace: true,
        },
        {
          label: "Add team to edit suffix",
          value: mainSequence.permissions.addTeamToEditSuffix,
          monospace: true,
        },
        {
          label: "Remove team from view suffix",
          value: mainSequence.permissions.removeTeamFromViewSuffix,
          monospace: true,
        },
        {
          label: "Remove team from edit suffix",
          value: mainSequence.permissions.removeTeamFromEditSuffix,
          monospace: true,
        },
      ],
    },
    {
      title: "Notifications",
      description: "Routes and mode used by the notification center.",
      fields: [
        { label: "List URL", value: notifications.listUrl, monospace: true },
        { label: "Detail URL", value: notifications.detailUrl, monospace: true },
        { label: "Mark read URL", value: notifications.markReadUrl, monospace: true },
        { label: "Dismiss URL", value: notifications.dismissUrl, monospace: true },
        { label: "Mark all read URL", value: notifications.markAllReadUrl, monospace: true },
        { label: "Dismiss all URL", value: notifications.dismissAllUrl, monospace: true },
        { label: "Type", value: notifications.type, monospace: true },
      ],
    },
  ];
}

export function SettingsDialog({
  mode,
  onClose,
  open,
  user,
}: SettingsDialogProps) {
  const { i18n, t } = useTranslation();
  const { toast } = useToast();
  const config = useCommandCenterConfig();
  const { app, auth } = config;
  const { availableThemes, resetOverrides, setThemeById, themeId } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [showRawConfiguration, setShowRawConfiguration] = useState(false);
  const requestPasswordChangeMutation = useMutation({
    mutationFn: requestPasswordChangeEmail,
    onSuccess: (result) => {
      toast({
        variant: "success",
        title: "Password change email sent",
        description: result.detail,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Unable to send password change email",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });

  const title =
    mode === "platform" ? t("settingsDialog.adminTitle") : t("settingsDialog.userTitle");
  const description =
    mode === "platform"
      ? t("settingsDialog.adminDescription")
      : t("settingsDialog.userDescription");
  const roleLabel = getAccessProfileLabel(user) || (mode === "platform" ? "Platform Admin" : "User");
  const activeLanguage = isSupportedLanguage(i18n.resolvedLanguage ?? i18n.language)
    ? (i18n.resolvedLanguage ?? i18n.language)
    : defaultLanguage;
  const activeThemeLabel =
    availableThemes.find((theme) => theme.id === themeId)?.label ?? themeId;
  const activeLanguageLabel =
    languageOptions.find((language) => language.code === activeLanguage)?.label ?? "English";
  const organizationTeamNames =
    user?.organizationTeams?.map((team) => team.name).filter(Boolean) ?? [];
  const legacyTeam =
    user?.team && user.team !== "Unknown" ? user.team : undefined;
  const teamsValue =
    organizationTeamNames.length > 0
      ? organizationTeamNames.join(", ")
      : legacyTeam ?? t("common.unavailable");
  const groupsValue =
    user?.groups && user.groups.length > 0
      ? user.groups.join(", ")
      : t("common.unavailable");
  const authTokenUrl = resolveSettingsUrl(env.apiBaseUrl, auth.jwt.tokenUrl);
  const authRefreshUrl = resolveSettingsUrl(env.apiBaseUrl, auth.jwt.refreshUrl);
  const authUserDetailsUrl = resolveSettingsUrl(env.apiBaseUrl, auth.jwt.userDetails.url);
  const configurationSource = commandCenterConfigSource;
  const configurationGroups = buildConfigurationGroups({
    config,
    authTokenUrl,
    authRefreshUrl,
    authUserDetailsUrl,
  });
  const navItems: Array<{
    id: SettingsSectionId;
    label: string;
    icon: typeof Settings2;
  }> = [
    { id: "general" as const, label: t("settingsDialog.generalNav"), icon: Settings2 },
    { id: "account" as const, label: t("settingsDialog.accountTitle"), icon: CircleUserRound },
    ...(mode === "platform"
      ? [
          {
            id: "auth" as const,
            label: t("settingsDialog.authNav"),
            icon: ShieldCheck,
          },
          {
            id: "configuration" as const,
            label: t("settingsDialog.configurationNav"),
            icon: FileCode2,
          },
        ]
      : []),
    { id: "about" as const, label: t("settingsDialog.aboutNav"), icon: Info },
  ];

  useEffect(() => {
    if (open) {
      setActiveSection("general");
      setShowRawConfiguration(false);
    }
  }, [open, mode]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="min-h-[min(720px,calc(100vh-32px))] max-w-[min(1200px,calc(100vw-24px))]"
    >
      <div className="grid min-h-[560px] gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-white/8 px-3 py-3 md:border-b-0 md:border-r md:px-4 md:py-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <SettingsNavButton
                key={item.id}
                active={activeSection === item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => {
                  setActiveSection(item.id);
                }}
              />
            ))}
          </nav>
        </aside>

        <div className="min-w-0 px-5 py-5 md:px-8 md:py-7">
          {activeSection === "general" ? (
            <SettingsSection
              title={t("settingsDialog.webUiTitle")}
            >
              <SettingsRow
                label={t("settingsDialog.themePreset")}
                value={
                  <Select
                    id={`${mode}-theme-select`}
                    value={themeId}
                    className="w-[220px]"
                    onChange={(event) => {
                      setThemeById(event.target.value);
                    }}
                  >
                    {availableThemes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </Select>
                }
              />
              <SettingsRow
                label={t("settingsDialog.language")}
                description={t("settingsDialog.languageQuestion")}
                value={
                  <Select
                    id={`${mode}-language-select`}
                    value={activeLanguage}
                    className="w-[220px]"
                    onChange={(event) => {
                      void i18n.changeLanguage(event.target.value);
                    }}
                  >
                    {languageOptions.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.label}
                      </option>
                    ))}
                  </Select>
                }
              />
              <SettingsRow
                label={t("settingsDialog.notifications")}
                value={t("settingsDialog.notificationsOff")}
              />
            </SettingsSection>
          ) : null}

          {activeSection === "account" ? (
            <SettingsSection
              title={t("settingsDialog.accountTitle")}
              description={t("settingsDialog.accountDescription")}
            >
              <div className="flex items-center gap-4 py-4">
                <Avatar
                  name={user?.name ?? t("common.unknownUser")}
                  src={user?.avatarUrl}
                  className="h-14 w-14 border border-white/10 bg-white/[0.03]"
                  iconClassName="h-5 w-5"
                />
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-topbar-foreground">
                    {user?.name ?? t("common.unknownUser")}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {user?.email ?? t("common.unavailable")}
                  </div>
                </div>
              </div>
              <SettingsRow
                label={t("settingsDialog.name")}
                value={user?.name ?? t("common.unknownUser")}
              />
              <SettingsRow
                label={t("settingsDialog.email")}
                value={user?.email ?? t("common.unavailable")}
              />
              <SettingsRow
                label={t("settingsDialog.team")}
                value={teamsValue}
              />
              <SettingsRow
                label={t("settingsDialog.role")}
                value={<Badge variant={mode === "platform" ? "primary" : "neutral"}>{roleLabel}</Badge>}
              />
              <SettingsRow
                label={t("settingsDialog.groups")}
                value={groupsValue}
              />
              {!env.bypassAuth && user?.email ? (
                <SettingsRow
                  label="Password"
                  description="Send a password change email to the address on this account."
                  value={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={requestPasswordChangeMutation.isPending}
                      onClick={() => {
                        requestPasswordChangeMutation.mutate();
                      }}
                    >
                      {requestPasswordChangeMutation.isPending
                        ? "Sending email..."
                        : "Send password change email"}
                    </Button>
                  }
                />
              ) : null}
            </SettingsSection>
          ) : null}

          {mode === "platform" && activeSection === "auth" ? (
            <SettingsSection
              title={t("settingsDialog.authTitle")}
              description={t("settingsDialog.authDescription")}
            >
              <SettingsRow
                label={t("settingsDialog.authRoleGroupMapping")}
                description={t("settingsDialog.authRoleGroupMappingHelp")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    auth.jwt.claim_mapping.* + auth.jwt.user_details.response_mapping.*
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.authUserGroup")}
                description={t("settingsDialog.authUserGroupHelp")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {"/api/v1/command_center/users/{user_id}/shell-access/ -> effective_permissions"}
                  </span>
                }
              />
              <SettingsRow
                label="Platform permissions field"
                description="Backend-owned platform permission mapping used for Admin Settings access."
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {auth.jwt.claimMapping.platformPermissions}
                  </span>
                }
              />
              <SettingsRow
                label="Platform admin flag field"
                description="Optional backend flag that can elevate a session to platform-admin access."
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {auth.jwt.userDetails.responseMapping.isPlatformAdmin}
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.api")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {env.apiBaseUrl}
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.authTokenUrl")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {authTokenUrl}
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.authRefreshUrl")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {authRefreshUrl}
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.authUserDetailsUrl")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {authUserDetailsUrl}
                  </span>
                }
              />
            </SettingsSection>
          ) : null}

          {mode === "platform" && activeSection === "configuration" ? (
            <SettingsSection
              title={t("settingsDialog.configurationTitle")}
              description={t("settingsDialog.configurationDescription")}
            >
              <SettingsRow
                label={t("settingsDialog.configurationFile")}
                description={t("settingsDialog.configurationFileHelp")}
                value={
                  <div className="flex max-w-[420px] flex-col items-end gap-2 text-right">
                    <span className="block break-all font-mono text-xs text-foreground">
                      config/command-center.yaml
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowRawConfiguration((currentValue) => !currentValue);
                      }}
                    >
                      {showRawConfiguration ? "Hide YAML" : "Show YAML"}
                    </Button>
                  </div>
                }
              />
              <div className="space-y-4 py-4">
                <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
                  <div className="text-sm font-medium text-topbar-foreground">
                    Structured configuration mapping
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Each YAML section is mapped into explicit fields below so this admin screen can
                    evolve into an editable configuration surface without changing the configuration
                    shape first.
                  </div>
                </div>
                <div className="grid gap-4">
                  {configurationGroups.map((group) => (
                    <SettingsConfigGroup key={group.title} {...group} />
                  ))}
                </div>
              </div>
              {showRawConfiguration ? (
                <div className="py-4">
                  <div className="mb-2 text-sm font-medium text-topbar-foreground">
                    {t("settingsDialog.configurationYaml")}
                  </div>
                  <div className="mb-4 text-sm text-muted-foreground">
                    {t("settingsDialog.configurationYamlHelp")}
                  </div>
                  <SettingsCodeBlock value={configurationSource} />
                </div>
              ) : null}
            </SettingsSection>
          ) : null}

          {activeSection === "about" ? (
            <SettingsSection
              title={t("settingsDialog.aboutNav")}
              description={t("settingsDialog.aboutDescription")}
            >
              <SettingsRow
                label={t("settingsDialog.product")}
                value={app.name}
              />
              <SettingsRow
                label={t("settingsDialog.currentTheme")}
                value={activeThemeLabel}
              />
              <SettingsRow
                label={t("settingsDialog.currentLanguage")}
                value={activeLanguageLabel}
              />
              <SettingsRow
                label={t("settingsDialog.localization")}
                value="react-i18next + i18next"
              />
              <SettingsRow
                label={t("settingsDialog.resetThemeOverrides")}
                description={t("settingsDialog.resetThemeHelp")}
                value={
                  <Button type="button" variant="outline" size="sm" onClick={resetOverrides}>
                    {t("settingsDialog.resetThemeOverrides")}
                  </Button>
                }
              />
              {mode === "platform" ? (
                <>
                  {env.useMockData ? (
                    <SettingsRow
                      label={t("settingsDialog.dataMode")}
                      value={<Badge variant="warning">{t("settingsDialog.mockData")}</Badge>}
                    />
                  ) : null}
                  <SettingsRow label={t("settingsDialog.api")} value={env.apiBaseUrl} />
                  <SettingsRow label={t("settingsDialog.websocket")} value={env.wsUrl} />
                </>
              ) : null}
            </SettingsSection>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
