import { type ReactNode, useEffect, useState } from "react";

import { CircleUserRound, Info, Settings2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { fetchCurrentAuthGroups } from "@/auth/api";
import { getRoleLabel } from "@/auth/permissions";
import { env } from "@/config/env";
import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";
import { defaultLanguage, isSupportedLanguage, languageOptions } from "@/i18n/config";
import type { AppUser } from "@/auth/types";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

interface SettingsDialogProps {
  mode: "admin" | "user";
  onClose: () => void;
  open: boolean;
  user?: AppUser;
}

type SettingsSectionId = "general" | "account" | "auth" | "about";

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

export function SettingsDialog({
  mode,
  onClose,
  open,
  user,
}: SettingsDialogProps) {
  const { i18n, t } = useTranslation();
  const { app, auth } = useCommandCenterConfig();
  const { availableThemes, resetOverrides, setThemeById, themeId } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [currentGroups, setCurrentGroups] = useState<string[] | null>(null);
  const [currentGroupsError, setCurrentGroupsError] = useState<string | null>(null);
  const [currentGroupsLoading, setCurrentGroupsLoading] = useState(false);

  const title =
    mode === "admin" ? t("settingsDialog.adminTitle") : t("settingsDialog.userTitle");
  const description =
    mode === "admin"
      ? t("settingsDialog.adminDescription")
      : t("settingsDialog.userDescription");
  const roleLabel = user?.role
    ? getRoleLabel(user.role)
    : mode === "admin"
      ? "Administrator"
      : "User";
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
  const authTokenUrl = resolveSettingsUrl(auth.baseUrl, auth.jwt.tokenUrl);
  const authRefreshUrl = resolveSettingsUrl(auth.baseUrl, auth.jwt.refreshUrl);
  const authUserDetailsUrl = resolveSettingsUrl(auth.baseUrl, auth.jwt.userDetails.url);
  const authGroupsUrl = resolveSettingsUrl(auth.baseUrl, auth.jwt.userDetails.groupsUrl);
  const authAdminGroupValue =
    auth.jwt.userDetails.roleGroups.admin || t("common.unavailable");
  const authUserGroupValue =
    auth.jwt.userDetails.roleGroups.user || t("settingsDialog.authUserFallback");
  const navItems: Array<{
    id: SettingsSectionId;
    label: string;
    icon: typeof Settings2;
  }> = [
    { id: "general" as const, label: t("settingsDialog.generalNav"), icon: Settings2 },
    { id: "account" as const, label: t("settingsDialog.accountTitle"), icon: CircleUserRound },
    ...(mode === "admin"
      ? [
          {
            id: "auth" as const,
            label: t("settingsDialog.authNav"),
            icon: ShieldCheck,
          },
        ]
      : []),
    { id: "about" as const, label: t("settingsDialog.aboutNav"), icon: Info },
  ];

  useEffect(() => {
    if (open) {
      setActiveSection("general");
      setCurrentGroups(null);
      setCurrentGroupsError(null);
      setCurrentGroupsLoading(false);
    }
  }, [open, mode]);

  async function handleLoadCurrentGroups() {
    setCurrentGroupsLoading(true);
    setCurrentGroupsError(null);

    try {
      const groups = await fetchCurrentAuthGroups();
      setCurrentGroups(groups);
    } catch (error) {
      setCurrentGroupsError(
        error instanceof Error ? error.message : t("settingsDialog.authCurrentGroupsError"),
      );
      setCurrentGroups(null);
    } finally {
      setCurrentGroupsLoading(false);
    }
  }

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
                value={<Badge variant={mode === "admin" ? "primary" : "neutral"}>{roleLabel}</Badge>}
              />
              <SettingsRow
                label={t("settingsDialog.groups")}
                value={groupsValue}
              />
            </SettingsSection>
          ) : null}

          {mode === "admin" && activeSection === "auth" ? (
            <SettingsSection
              title={t("settingsDialog.authTitle")}
              description={t("settingsDialog.authDescription")}
            >
              <SettingsRow
                label={t("settingsDialog.authRoleGroupMapping")}
                description={t("settingsDialog.authRoleGroupMappingHelp")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    auth.jwt.user_details.role_groups
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.authAdminGroup")}
                description={t("settingsDialog.authAdminGroupHelp")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {authAdminGroupValue}
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.authUserGroup")}
                description={t("settingsDialog.authUserGroupHelp")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {authUserGroupValue}
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.authBaseUrl")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {auth.baseUrl}
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
              <SettingsRow
                label={t("settingsDialog.authGroupsUrl")}
                description={t("settingsDialog.authGroupsUrlHelp")}
                value={
                  <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
                    {authGroupsUrl}
                  </span>
                }
              />
              <SettingsRow
                label={t("settingsDialog.authCurrentGroups")}
                description={t("settingsDialog.authCurrentGroupsHelp")}
                value={
                  <div className="flex max-w-[420px] flex-col items-end gap-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentGroupsLoading}
                      onClick={() => {
                        void handleLoadCurrentGroups();
                      }}
                    >
                      {currentGroupsLoading
                        ? t("settingsDialog.authLoadingCurrentGroups")
                        : t("settingsDialog.authShowCurrentGroups")}
                    </Button>
                    {currentGroupsError ? (
                      <div className="text-xs text-danger">{currentGroupsError}</div>
                    ) : null}
                    {currentGroups ? (
                      currentGroups.length > 0 ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {currentGroups.map((group) => (
                            <Badge key={group} variant="primary">
                              {group}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {t("settingsDialog.authNoCurrentGroups")}
                        </div>
                      )
                    ) : null}
                  </div>
                }
              />
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
              {mode === "admin" ? (
                <>
                  <SettingsRow
                    label={t("settingsDialog.dataMode")}
                    value={
                      <Badge variant={env.useMockData ? "warning" : "success"}>
                        {env.useMockData
                          ? t("settingsDialog.mockData")
                          : t("settingsDialog.liveData")}
                      </Badge>
                    }
                  />
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
