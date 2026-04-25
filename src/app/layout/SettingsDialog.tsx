import { type ReactNode, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Cable,
  ChevronDown,
  CircleUserRound,
  FileCode2,
  Info,
  Loader2,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  buildWidgetTypeSyncDraft,
  syncWidgetTypes,
  type WidgetTypeSyncResponse,
} from "@/app/registry/widget-type-sync";
import {
  buildConnectionTypeSyncDraft,
  syncConnectionTypes,
  type ConnectionTypeSyncResponse,
} from "@/app/registry/connection-type-sync";
import { getAccessibleShellMenuEntries } from "@/apps/utils";
import {
  getCurrentUserMfaSetup,
  getCurrentUserMfaStatus,
  listCurrentUserSessions,
  requestPasswordChangeEmail,
  revokeCurrentUserSession,
  revokeOtherCurrentUserSessions,
  verifyCurrentUserMfaSetup,
  type CurrentUserMfaSetupResponse,
} from "@/auth/api";
import { useAuthStore } from "@/auth/auth-store";
import { persistJwtSession } from "@/auth/jwt-auth";
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
import type { AppIcon, AppShellMenuAudience } from "@/apps/types";

interface SettingsDialogProps {
  mode: "platform" | "user";
  onClose: () => void;
  open: boolean;
  requestedSectionId?: string | null;
  user?: AppUser;
}

type SettingsSectionId = string;

function formatRegistrySyncTimestamp(value?: string) {
  if (!value) {
    return "Not available";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

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

function formatSessionTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function normalizeMfaCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function syncSessionMfaEnabled(mfaEnabled: boolean) {
  const authState = useAuthStore.getState();
  const currentSession = authState.session;

  if (!currentSession) {
    return;
  }

  const nextSession = {
    ...currentSession,
    user: {
      ...currentSession.user,
      mfaEnabled,
    },
  };

  useAuthStore.setState({
    session: nextSession,
  });
  persistJwtSession({
    session: nextSession,
    tokens: {
      accessToken: nextSession.token,
      refreshToken: authState.refreshToken,
      tokenType: nextSession.tokenType ?? "Bearer",
      expiresAt: nextSession.expiresAt,
    },
  });
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
  icon: AppIcon;
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

function WidgetRegistrySettingsSection({
  syncUrl,
}: {
  syncUrl: string;
}) {
  const { toast } = useToast();
  const draftQuery = useQuery({
    queryKey: ["widget-registry", "sync-payload"],
    queryFn: buildWidgetTypeSyncDraft,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [lastResult, setLastResult] = useState<WidgetTypeSyncResponse | null>(null);
  const widgetCategories = useMemo(() => {
    const counts = new Map<string, number>();

    for (const widget of draftQuery.data?.payload.widgets ?? []) {
      counts.set(widget.category, (counts.get(widget.category) ?? 0) + 1);
    }

    return [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [draftQuery.data?.payload.widgets]);
  const widgetIdsPreview = useMemo(
    () => (draftQuery.data?.payload.widgets ?? []).map((widget) => widget.widgetId),
    [draftQuery.data?.payload.widgets],
  );
  const widgetContractPreview = useMemo(
    () =>
      (draftQuery.data?.payload.widgets ?? []).slice(0, 8).map((widget) => ({
        widgetId: widget.widgetId,
        widgetVersion:
          typeof widget.schema === "object" && widget.schema && "widgetVersion" in widget.schema
            ? (widget.schema as Record<string, unknown>).widgetVersion
            : undefined,
        runtime:
          typeof widget.schema === "object" && widget.schema && "runtime" in widget.schema
            ? (widget.schema as Record<string, unknown>).runtime
            : undefined,
        configuration:
          typeof widget.schema === "object" && widget.schema && "configuration" in widget.schema
            ? (widget.schema as Record<string, unknown>).configuration
            : undefined,
        io:
          typeof widget.io === "object" && widget.io
            ? widget.io
            : undefined,
      })),
    [draftQuery.data?.payload.widgets],
  );
  const syncMutation = useMutation({
    mutationFn: async () => {
      const nextDraft = await buildWidgetTypeSyncDraft();
      return {
        draft: nextDraft,
        result: await syncWidgetTypes(nextDraft.payload),
      };
    },
    onSuccess: ({ draft, result }) => {
      setLastResult(result);
      void draftQuery.refetch();
      toast({
        variant: "success",
        title: "Widget registry published",
        description:
          result.status === "synced"
            ? `Created ${result.created ?? 0}, updated ${result.updated ?? 0}, deactivated ${result.deactivated ?? 0}.`
            : "Backend registry already matched the current widget manifest.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Widget registry publish failed",
        description: error instanceof Error ? error.message : "Unable to publish widget registry.",
      });
    },
  });

  return (
    <SettingsSection
      title="Widget registry"
      description="Publish the live frontend widget catalog to the backend widget-type registry explicitly from this platform-admin surface."
    >
      <SettingsRow
        label="Sync endpoint"
        description="Backend endpoint that receives the versioned widget manifest."
        value={
          <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
            {syncUrl || "Not configured"}
          </span>
        }
      />
      <SettingsRow
        label="Manifest"
        description="Versioned local widget catalog preview generated from the current frontend registry."
        value={
          draftQuery.isLoading ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building manifest
            </span>
          ) : draftQuery.isError ? (
            <span className="text-sm text-danger">
              {draftQuery.error instanceof Error
                ? draftQuery.error.message
                : "Unable to build widget manifest."}
            </span>
          ) : (
            <div className="space-y-2 text-right">
              <div className="flex flex-wrap justify-end gap-2">
                <Badge variant="neutral">
                  {(draftQuery.data?.payload.widgets.length ?? 0).toLocaleString()} widgets
                </Badge>
                <Badge variant="neutral">
                  {widgetCategories.length.toLocaleString()} categories
                </Badge>
                <Badge
                  variant={
                    (draftQuery.data?.validationIssues.length ?? 0) > 0 ? "warning" : "neutral"
                  }
                >
                  {(draftQuery.data?.validationIssues.length ?? 0).toLocaleString()} issues
                </Badge>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {draftQuery.data?.payload.registryVersion ?? "—"}
              </div>
            </div>
          )
        }
      />
      <SettingsRow
        label="Checksum"
        description="Backend no-op protection for identical widget manifests."
        value={
          <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
            {draftQuery.data?.payload.checksum ?? "Unavailable"}
          </span>
        }
      />
      <SettingsRow
        label="Publish"
        description="This action writes the current widget catalog to the backend. It no longer runs during normal sign-in."
        value={
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  syncMutation.mutate();
                }}
                disabled={
                  !syncUrl.trim() ||
                  draftQuery.isLoading ||
                  draftQuery.isError ||
                  (draftQuery.data?.validationIssues.length ?? 0) > 0 ||
                  draftQuery.isFetching ||
                  syncMutation.isPending
                }
              >
                {syncMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing
                  </>
                ) : (
                  "Publish widget registry"
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {lastResult
                ? `Last result: ${lastResult.status} at ${formatRegistrySyncTimestamp(lastResult.lastSyncedAt)}`
                : "No publish has been run from this session yet."}
            </div>
          </div>
        }
      />

      <div className="space-y-4 py-4">
        {(draftQuery.data?.validationIssues.length ?? 0) > 0 ? (
          <div className="rounded-[calc(var(--radius)-4px)] border border-warning/40 bg-warning/10 p-4">
            <div className="text-sm font-medium text-topbar-foreground">Manifest validation issues</div>
            <div className="mt-1 text-sm text-muted-foreground">
              These widgets are missing required registry-contract metadata. Publication stays disabled until they are fixed.
            </div>
            <div className="mt-3">
              <SettingsCodeBlock
                value={(draftQuery.data?.validationIssues ?? [])
                  .map((issue) => `${issue.widgetId} [${issue.section}] ${issue.message}`)
                  .join("\n")}
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-topbar-foreground">Registry categories</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {widgetCategories.length > 0 ? (
              widgetCategories.map(([category, count]) => (
                <Badge key={category} variant="neutral">
                  {category}: {count}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No widget categories available.</span>
            )}
          </div>
        </div>

        <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-topbar-foreground">Widget id preview</div>
          <div className="mt-1 text-sm text-muted-foreground">
            All widget ids from the current local registry manifest.
          </div>
          <div className="mt-3">
            <SettingsCodeBlock value={widgetIdsPreview.join("\n") || "No widgets available."} />
          </div>
        </div>

        <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-topbar-foreground">Contract preview</div>
          <div className="mt-1 text-sm text-muted-foreground">
            First 8 widgets with their internal version, runtime contract, configuration contract, and IO contract.
          </div>
          <div className="mt-3">
            <SettingsCodeBlock
              value={
                widgetContractPreview.length > 0
                  ? JSON.stringify(widgetContractPreview, null, 2)
                  : "No widgets available."
              }
            />
          </div>
        </div>

        {lastResult ? (
          <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-topbar-foreground">Last publish result</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={lastResult.status === "synced" ? "primary" : "neutral"}>
                {lastResult.status}
              </Badge>
              {typeof lastResult.created === "number" ? (
                <Badge variant="neutral">Created: {lastResult.created}</Badge>
              ) : null}
              {typeof lastResult.updated === "number" ? (
                <Badge variant="neutral">Updated: {lastResult.updated}</Badge>
              ) : null}
              {typeof lastResult.deactivated === "number" ? (
                <Badge variant="neutral">Deactivated: {lastResult.deactivated}</Badge>
              ) : null}
              {typeof lastResult.total === "number" ? (
                <Badge variant="neutral">Total: {lastResult.total}</Badge>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </SettingsSection>
  );
}

function ConnectionRegistrySettingsSection({
  syncUrl,
}: {
  syncUrl: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const draftQuery = useQuery({
    queryKey: ["connection-registry", "sync-payload"],
    queryFn: buildConnectionTypeSyncDraft,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [lastResult, setLastResult] = useState<ConnectionTypeSyncResponse | null>(null);
  const connectionCategories = useMemo(() => {
    const counts = new Map<string, number>();

    for (const connection of draftQuery.data?.payload.connections ?? []) {
      counts.set(connection.category, (counts.get(connection.category) ?? 0) + 1);
    }

    return [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [draftQuery.data?.payload.connections]);
  const connectionIdsPreview = useMemo(
    () => (draftQuery.data?.payload.connections ?? []).map((connection) => connection.typeId),
    [draftQuery.data?.payload.connections],
  );
  const syncMutation = useMutation({
    mutationFn: async () => {
      const nextDraft = await buildConnectionTypeSyncDraft();
      return {
        draft: nextDraft,
        result: await syncConnectionTypes(nextDraft.payload),
      };
    },
    onSuccess: ({ result }) => {
      setLastResult(result);
      void draftQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["connections", "types"] });
      toast({
        variant: "success",
        title: "Connection registry published",
        description:
          result.status === "synced"
            ? `Created ${result.created ?? 0}, updated ${result.updated ?? 0}, deactivated ${result.deactivated ?? 0}.`
            : "Backend registry already matched the current connection manifest.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Connection registry publish failed",
        description:
          error instanceof Error ? error.message : "Unable to publish connection registry.",
      });
    },
  });

  return (
    <SettingsSection
      title="Connection registry"
      description="Publish extension-registered connection types to the backend. The Connections app only shows types that are active in this backend registry."
    >
      <SettingsRow
        label="Sync endpoint"
        description="Backend endpoint that receives the versioned connection-type manifest."
        value={
          <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
            {syncUrl || "Not configured"}
          </span>
        }
      />
      <SettingsRow
        label="Manifest"
        description="Versioned local connection catalog preview generated from the current frontend registry."
        value={
          draftQuery.isLoading ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building manifest
            </span>
          ) : draftQuery.isError ? (
            <span className="text-sm text-danger">
              {draftQuery.error instanceof Error
                ? draftQuery.error.message
                : "Unable to build connection manifest."}
            </span>
          ) : (
            <div className="space-y-2 text-right">
              <div className="flex flex-wrap justify-end gap-2">
                <Badge variant="neutral">
                  {(draftQuery.data?.payload.connections.length ?? 0).toLocaleString()} types
                </Badge>
                <Badge variant="neutral">
                  {connectionCategories.length.toLocaleString()} categories
                </Badge>
                <Badge
                  variant={
                    (draftQuery.data?.validationIssues.length ?? 0) > 0 ? "warning" : "neutral"
                  }
                >
                  {(draftQuery.data?.validationIssues.length ?? 0).toLocaleString()} issues
                </Badge>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {draftQuery.data?.payload.registryVersion ?? "—"}
              </div>
            </div>
          )
        }
      />
      <SettingsRow
        label="Checksum"
        description="Backend no-op protection for identical connection manifests."
        value={
          <span className="block max-w-[420px] break-all font-mono text-xs text-foreground">
            {draftQuery.data?.payload.checksum ?? "Unavailable"}
          </span>
        }
      />
      <SettingsRow
        label="Publish"
        description="This writes the current connection type catalog to the backend availability gate."
        value={
          <div className="flex flex-col items-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                syncMutation.mutate();
              }}
              disabled={
                !syncUrl.trim() ||
                draftQuery.isLoading ||
                draftQuery.isError ||
                (draftQuery.data?.validationIssues.length ?? 0) > 0 ||
                draftQuery.isFetching ||
                syncMutation.isPending
              }
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing
                </>
              ) : (
                "Publish connection registry"
              )}
            </Button>
            <div className="text-xs text-muted-foreground">
              {lastResult
                ? `Last result: ${lastResult.status} at ${formatRegistrySyncTimestamp(lastResult.lastSyncedAt)}`
                : "No publish has been run from this session yet."}
            </div>
          </div>
        }
      />

      <div className="space-y-4 py-4">
        {(draftQuery.data?.validationIssues.length ?? 0) > 0 ? (
          <div className="rounded-[calc(var(--radius)-4px)] border border-warning/40 bg-warning/10 p-4">
            <div className="text-sm font-medium text-topbar-foreground">Manifest validation issues</div>
            <div className="mt-1 text-sm text-muted-foreground">
              These connection types are missing required registry metadata. Publication stays disabled until they are fixed.
            </div>
            <div className="mt-3">
              <SettingsCodeBlock
                value={(draftQuery.data?.validationIssues ?? [])
                  .map((issue) => `${issue.typeId} [${issue.section}] ${issue.message}`)
                  .join("\n")}
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-topbar-foreground">Connection categories</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {connectionCategories.length > 0 ? (
              connectionCategories.map(([category, count]) => (
                <Badge key={category} variant="neutral">
                  {category}: {count}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                No connection categories available.
              </span>
            )}
          </div>
        </div>

        <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-topbar-foreground">Connection type id preview</div>
          <div className="mt-1 text-sm text-muted-foreground">
            All connection type ids from the current local manifest.
          </div>
          <div className="mt-3">
            <SettingsCodeBlock
              value={connectionIdsPreview.join("\n") || "No connection types available."}
            />
          </div>
        </div>

        {lastResult ? (
          <div className="rounded-[calc(var(--radius)-4px)] border border-white/8 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-topbar-foreground">Last publish result</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={lastResult.status === "synced" ? "primary" : "neutral"}>
                {lastResult.status}
              </Badge>
              {typeof lastResult.created === "number" ? (
                <Badge variant="neutral">Created: {lastResult.created}</Badge>
              ) : null}
              {typeof lastResult.updated === "number" ? (
                <Badge variant="neutral">Updated: {lastResult.updated}</Badge>
              ) : null}
              {typeof lastResult.deactivated === "number" ? (
                <Badge variant="neutral">Deactivated: {lastResult.deactivated}</Badge>
              ) : null}
              {typeof lastResult.total === "number" ? (
                <Badge variant="neutral">Total: {lastResult.total}</Badge>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </SettingsSection>
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
      title: "Assistant UI",
      description: "Runtime endpoint and protocol used by the detachable assistant shell.",
      fields: [
        {
          label: "Assistant endpoint",
          value: config.assistantUi.endpoint,
          monospace: true,
        },
        { label: "Assistant protocol", value: config.assistantUi.protocol, monospace: true },
      ],
    },
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
  requestedSectionId,
  user,
}: SettingsDialogProps) {
  const { i18n, t } = useTranslation();
  const { toast } = useToast();
  const config = useCommandCenterConfig();
  const { app, auth } = config;
  const { availableThemes, resetOverrides, setThemeById, themeId } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [showRawConfiguration, setShowRawConfiguration] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  const [authenticatedMfaSetup, setAuthenticatedMfaSetup] =
    useState<CurrentUserMfaSetupResponse | null>(null);
  const [authenticatedMfaCode, setAuthenticatedMfaCode] = useState("");
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
  const userSessionsQuery = useQuery({
    queryKey: ["auth", "current-user-sessions"],
    queryFn: listCurrentUserSessions,
    staleTime: 30_000,
    enabled: open && mode === "user",
  });
  const mfaStatusQuery = useQuery({
    queryKey: ["auth", "current-user-mfa-status"],
    queryFn: getCurrentUserMfaStatus,
    staleTime: 30_000,
    enabled: open && mode === "user",
  });
  const revokeSessionMutation = useMutation({
    mutationFn: revokeCurrentUserSession,
    onSuccess: (session) => {
      if (session.is_current) {
        useAuthStore.getState().logout();
        onClose();
      }

      toast({
        variant: "success",
        title: "Session revoked",
        description: session.is_current
          ? "Your current session was revoked and signed out locally."
          : "Selected session was revoked.",
      });
      void userSessionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Unable to revoke session",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });
  const revokeOtherSessionsMutation = useMutation({
    mutationFn: revokeOtherCurrentUserSessions,
    onSuccess: (response) => {
      toast({
        variant: "success",
        title: "Other sessions revoked",
        description: `${response.detail} (${response.revoked_count} revoked)`,
      });
      void userSessionsQuery.refetch();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Unable to revoke other sessions",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });
  const startAuthenticatedMfaSetupMutation = useMutation({
    mutationFn: getCurrentUserMfaSetup,
    onSuccess: (response) => {
      setAuthenticatedMfaSetup(response);
      setAuthenticatedMfaCode("");
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Unable to start MFA setup",
        description: error instanceof Error ? error.message : "The request failed.",
      });
    },
  });
  const verifyAuthenticatedMfaSetupMutation = useMutation({
    mutationFn: () =>
      verifyCurrentUserMfaSetup({
        mfa_code: authenticatedMfaCode.trim(),
      }),
    onSuccess: (response) => {
      syncSessionMfaEnabled(response.mfa_enabled);
      setAuthenticatedMfaSetup(null);
      setAuthenticatedMfaCode("");
      toast({
        variant: "success",
        title: "MFA enabled",
        description: response.detail,
      });
      void mfaStatusQuery.refetch();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Unable to verify MFA setup",
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
  const sessions = userSessionsQuery.data ?? [];
  const currentMfaEnabled = mfaStatusQuery.data?.mfa_enabled ?? user?.mfaEnabled;
  const activeSessionCount = sessions.filter((session) => session.is_active).length;
  const otherActiveSessionCount = sessions.filter(
    (session) => !session.is_current && session.is_active && !session.is_revoked,
  ).length;
  const authTokenUrl = resolveSettingsUrl(env.apiBaseUrl, auth.jwt.tokenUrl);
  const authRefreshUrl = resolveSettingsUrl(env.apiBaseUrl, auth.jwt.refreshUrl);
  const authUserDetailsUrl = resolveSettingsUrl(env.apiBaseUrl, auth.jwt.userDetails.url);
  const configurationSource = commandCenterConfigSource;
  const permissions = user?.permissions ?? [];
  const shellMenuAudience: AppShellMenuAudience = mode === "platform" ? "admin" : "user";
  const contributedSections = useMemo(
    () => getAccessibleShellMenuEntries(permissions, shellMenuAudience),
    [permissions, shellMenuAudience],
  );
  const configurationGroups = buildConfigurationGroups({
    config,
    authTokenUrl,
    authRefreshUrl,
    authUserDetailsUrl,
  });
  const navItems: Array<{
    id: SettingsSectionId;
    label: string;
    icon: AppIcon;
  }> = [
    { id: "general" as const, label: t("settingsDialog.generalNav"), icon: Settings2 },
    { id: "account" as const, label: t("settingsDialog.accountTitle"), icon: CircleUserRound },
    ...(mode === "user"
      ? [
          {
            id: "security" as const,
            label: "Security",
            icon: ShieldCheck,
          },
        ]
      : []),
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
          {
            id: "registry" as const,
            label: "Widget Registry",
            icon: Boxes,
          },
          {
            id: "connection-registry" as const,
            label: "Connection Registry",
            icon: Cable,
          },
        ]
      : []),
    ...contributedSections.map((entry) => ({
      id: entry.id,
      label: entry.label,
      icon: entry.icon ?? entry.appIcon,
    })),
    { id: "about" as const, label: t("settingsDialog.aboutNav"), icon: Info },
  ];
  const activeContributedSection =
    contributedSections.find((entry) => entry.id === activeSection) ?? null;
  const ActiveContributedSectionComponent = activeContributedSection?.component ?? null;

  useEffect(() => {
    if (open) {
      setActiveSection(requestedSectionId ?? "general");
      setShowRawConfiguration(false);
      setAuthenticatedMfaSetup(null);
      setAuthenticatedMfaCode("");
    }
  }, [open, mode, requestedSectionId]);

  useEffect(() => {
    if (mfaStatusQuery.data?.mfa_enabled) {
      setAuthenticatedMfaSetup(null);
      setAuthenticatedMfaCode("");
    }
  }, [mfaStatusQuery.data?.mfa_enabled]);

  useEffect(() => {
    if (!open || !requestedSectionId) {
      return;
    }

    if (navItems.some((item) => item.id === requestedSectionId)) {
      setActiveSection(requestedSectionId);
    }
  }, [navItems, open, requestedSectionId]);

  useEffect(() => {
    if (!open || navItems.some((item) => item.id === activeSection)) {
      return;
    }

    setActiveSection(navItems[0]?.id ?? "general");
  }, [activeSection, navItems, open]);

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

          {mode === "user" && activeSection === "security" ? (
            <SettingsSection
              title="Security"
              description="Review your MFA status, manage MFA enrollment, and revoke login sessions you do not trust."
            >
              <SettingsRow
                label="Multi-factor authentication"
                description="Current status from the authenticated MFA status endpoint."
                value={
                  mfaStatusQuery.isLoading ? (
                    "Loading status..."
                  ) : mfaStatusQuery.isError ? (
                    "Unable to load status"
                  ) : (
                    <Badge
                      variant={
                        currentMfaEnabled === true
                          ? "success"
                          : currentMfaEnabled === false
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {currentMfaEnabled === true
                        ? "Enabled"
                        : currentMfaEnabled === false
                          ? "Not enabled"
                          : "Unknown"}
                    </Badge>
                  )
                }
              />
              {mfaStatusQuery.data?.mfa_enabled === false ? (
                <SettingsRow
                  label="Enable MFA"
                  description="Start the authenticated MFA enrollment flow for this account."
                  value={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={startAuthenticatedMfaSetupMutation.isPending || mfaStatusQuery.isLoading}
                      onClick={() => {
                        startAuthenticatedMfaSetupMutation.mutate();
                      }}
                    >
                      {startAuthenticatedMfaSetupMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Set up MFA
                    </Button>
                  }
                />
              ) : null}
              <SettingsRow
                label="Tracked sessions"
                value={
                  userSessionsQuery.isLoading
                    ? "Loading sessions..."
                    : userSessionsQuery.isError
                      ? "Unable to load sessions"
                      : `${sessions.length} total (${activeSessionCount} active)`
                }
              />
              <SettingsRow
                label="Revoke other sessions"
                description="Immediately revoke all active sessions except your current one."
                value={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokeOtherSessionsMutation.isPending || otherActiveSessionCount === 0}
                    onClick={() => {
                      revokeOtherSessionsMutation.mutate();
                    }}
                  >
                    {revokeOtherSessionsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Revoke others
                  </Button>
                }
              />
              <div className="space-y-3 py-4">
                {mfaStatusQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {mfaStatusQuery.error instanceof Error
                      ? mfaStatusQuery.error.message
                      : "Unable to load MFA status."}
                  </div>
                ) : null}
                {authenticatedMfaSetup ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-topbar-foreground">
                      Finish MFA enrollment
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {authenticatedMfaSetup.detail ||
                        "Scan the QR code or enter the manual key, then verify with your first authenticator code."}
                    </div>
                    <div className="mt-4 flex flex-wrap items-start gap-4">
                      {authenticatedMfaSetup.qr_png_base64 ? (
                        <img
                          src={`data:image/png;base64,${authenticatedMfaSetup.qr_png_base64}`}
                          alt="Authenticated MFA setup QR code"
                          className="h-36 w-36 rounded-[calc(var(--radius)-6px)] border border-white/12 bg-white p-2"
                        />
                      ) : null}
                      {authenticatedMfaSetup.manual_entry_key ? (
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Manual entry key
                          </div>
                          <div className="mt-2 rounded-[calc(var(--radius)-6px)] border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-topbar-foreground">
                            {authenticatedMfaSetup.manual_entry_key}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                          First authenticator code
                        </label>
                        <Input
                          name="settings-mfa-setup-code"
                          value={authenticatedMfaCode}
                          onChange={(event) => {
                            setAuthenticatedMfaCode(normalizeMfaCode(event.target.value));
                          }}
                          placeholder="123456"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          maxLength={6}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={verifyAuthenticatedMfaSetupMutation.isPending || authenticatedMfaCode.length !== 6}
                          onClick={() => {
                            verifyAuthenticatedMfaSetupMutation.mutate();
                          }}
                        >
                          {verifyAuthenticatedMfaSetupMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          Verify
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={verifyAuthenticatedMfaSetupMutation.isPending}
                          onClick={() => {
                            setAuthenticatedMfaSetup(null);
                            setAuthenticatedMfaCode("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {userSessionsQuery.isLoading ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-muted-foreground">
                    Loading sessions
                  </div>
                ) : null}
                {userSessionsQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {userSessionsQuery.error instanceof Error
                      ? userSessionsQuery.error.message
                      : "Unable to load login sessions."}
                  </div>
                ) : null}
                {!userSessionsQuery.isLoading && !userSessionsQuery.isError && sessions.length === 0 ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.02] px-4 py-4 text-sm text-muted-foreground">
                    No tracked sessions were returned.
                  </div>
                ) : null}
                {!userSessionsQuery.isLoading && !userSessionsQuery.isError
                  ? sessions.map((session) => {
                      const isBusy =
                        revokeSessionMutation.isPending && revokingSessionId === session.id;
                      const canRevoke = session.is_active && !session.is_revoked;
                      const lastSeenLabel = formatSessionTimestamp(session.last_seen_at);

                      return (
                        <details
                          key={session.id}
                          className="group rounded-[calc(var(--radius)-6px)] border border-white/8 bg-white/[0.02]"
                        >
                          <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-topbar-foreground">
                                {session.device_label || "Unknown device"}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="font-mono">
                                  {session.ip_address || "No IP available"}
                                </span>
                                <span>Last seen: {lastSeenLabel}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {session.is_current ? <Badge variant="primary">current</Badge> : null}
                                <Badge variant={session.is_active ? "success" : "neutral"}>
                                  {session.is_active ? "active" : "inactive"}
                                </Badge>
                                <Badge variant={session.is_revoked ? "warning" : "neutral"}>
                                  {session.is_revoked ? "revoked" : "not revoked"}
                                </Badge>
                              </div>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                Details
                                <ChevronDown className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </summary>
                          <div className="border-t border-white/8 px-4 py-3">
                            <div
                              className="max-w-[600px] truncate text-xs text-muted-foreground"
                              title={session.user_agent}
                            >
                              {session.user_agent || "No user agent"}
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                              <div>Login: {formatSessionTimestamp(session.login_time)}</div>
                              <div>Last refresh: {formatSessionTimestamp(session.last_refresh_at)}</div>
                              <div>Last seen: {lastSeenLabel}</div>
                              <div>Auth source: {session.auth_source || "unknown"}</div>
                            </div>
                            {session.revoked_reason?.trim() ? (
                              <div className="mt-2 text-xs text-muted-foreground">
                                Reason: {session.revoked_reason}
                              </div>
                            ) : null}
                            <div className="mt-3 flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canRevoke || revokeSessionMutation.isPending}
                                onClick={() => {
                                  setRevokingSessionId(session.id);
                                  revokeSessionMutation.mutate(session.id);
                                }}
                              >
                                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Revoke
                              </Button>
                            </div>
                          </div>
                        </details>
                      );
                    })
                  : null}
              </div>
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

          {mode === "platform" && activeSection === "registry" ? (
            <WidgetRegistrySettingsSection syncUrl={config.widgetTypes.syncUrl} />
          ) : null}

          {mode === "platform" && activeSection === "connection-registry" ? (
            <ConnectionRegistrySettingsSection syncUrl={config.connections.types.syncUrl} />
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

          {ActiveContributedSectionComponent && activeContributedSection ? (
            <SettingsSection
              title={activeContributedSection.label}
              description={activeContributedSection.description}
            >
              <ActiveContributedSectionComponent audience={shellMenuAudience} user={user} />
            </SettingsSection>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
