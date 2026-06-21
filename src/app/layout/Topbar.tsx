import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Rows3, Search, Settings2, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { getAppById, getAppSurfaceById } from "@/app/registry";
import {
  getAccessibleAdminMenuApps,
  getAccessibleApps,
  getFavoriteSurfaceEntries,
  getAccessibleSurfaceEntries,
  getAccessibleSurfaces,
  getAppPath,
  getDefaultSurface,
  getSurfaceFavoriteId,
  getSurfaceNavigationGroups,
  getSurfacePath,
} from "@/apps/utils";
import { useAuthStore } from "@/auth/auth-store";
import {
  hasOrganizationAdminAccess,
  hasPlatformAdminAccess,
} from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/config/env";
import {
  getCurrentUserCreditsSummary,
  type OrganizationCreditConsumptionSummary,
  type UserCreditSummaryBudget,
} from "@/extensions/core/apps/admin/api";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { useCustomWorkspaceStudioStore } from "@/features/dashboards/custom-workspace-studio-store";
import {
  getFavoriteWorkspaceEntries,
  isWorkspaceFavoriteId,
} from "@/features/dashboards/workspace-favorites";
import { AdminMenu } from "./AdminMenu";
import { AppSurfaceSelector } from "./AppSurfaceSelector";
import { FavoriteSurfacesMenu, type FavoriteMenuItem } from "./FavoriteSurfacesMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { SettingsDialog } from "./SettingsDialog";
import { ThemeMenu } from "./ThemeMenu";

const WORKSPACE_CANVAS_SURFACE_IDS = new Set(["workspaces", "slide-studio"]);
const USER_CREDIT_SUMMARY_QUERY_KEY = ["user", "credits", "summary"] as const;

interface BudgetUsageIndicatorProps {
  onOpenBilling: () => void;
}

function clampBudgetPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function getBudgetPercent(spentCents: number, limitCents: number) {
  if (!Number.isFinite(spentCents) || !Number.isFinite(limitCents) || limitCents <= 0) {
    return null;
  }

  return clampBudgetPercent((spentCents / limitCents) * 100);
}

function hasMonthlyBudgetLimit(userBudget: UserCreditSummaryBudget | null) {
  return Number(userBudget?.monthly_limit_cents) > 0;
}

function formatBudgetCurrency(
  cents: number,
  currency: string,
  options: { fixedFractionDigits?: boolean } = {},
) {
  const normalizedCents = Number(cents || 0);
  const amount = normalizedCents / 100;
  const normalizedCurrency = String(currency || "usd").toUpperCase();
  const fractionDigits = options.fixedFractionDigits
    ? 2
    : Math.abs(normalizedCents) % 100 === 0
      ? 0
      : 2;

  try {
    const numberFormatOptions: Intl.NumberFormatOptions = {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: fractionDigits,
    };
    if (options.fixedFractionDigits) {
      numberFormatOptions.minimumFractionDigits = fractionDigits;
    }

    return new Intl.NumberFormat(undefined, numberFormatOptions).format(amount);
  } catch {
    return `$${amount.toFixed(fractionDigits)}`;
  }
}

function getOrganizationConsumptionSegments(consumption: OrganizationCreditConsumptionSummary) {
  const total = Math.max(0, Number(consumption.total_cents || 0));

  if (total <= 0) {
    return {
      userAttributed: 0,
      shared: 0,
      unresolved: 0,
    };
  }

  const userAttributed = clampBudgetPercent(
    (Number(consumption.user_attributed_cents || 0) / total) * 100,
  );
  const unresolved = clampBudgetPercent((Number(consumption.unresolved_cents || 0) / total) * 100);
  const shared = Math.max(0, 100 - userAttributed - unresolved);

  return { userAttributed, shared, unresolved };
}

function BudgetRail({
  percent,
  title,
  compact = false,
}: {
  percent: number | null;
  title: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "min-w-0 overflow-hidden rounded-full bg-muted/55",
        compact ? "h-1" : "h-1.5",
      )}
      title={title}
    >
      <span
        className="block h-full min-w-1.5 rounded-full bg-primary/75 shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
        style={{ width: `${percent ?? 0}%` }}
      />
    </span>
  );
}

function OrganizationConsumptionRail({
  consumption,
  title,
}: {
  consumption: OrganizationCreditConsumptionSummary;
  title: string;
}) {
  const segments = getOrganizationConsumptionSegments(consumption);

  return (
    <span className="flex h-1 min-w-0 overflow-hidden rounded-full bg-muted/55" title={title}>
      <span
        className="h-full bg-primary/70"
        style={{ width: `${segments.userAttributed}%` }}
      />
      <span
        className="h-full bg-amber-400/70"
        style={{ width: `${segments.shared}%` }}
      />
      <span
        className="h-full bg-muted-foreground/45"
        style={{ width: `${segments.unresolved}%` }}
      />
    </span>
  );
}

function BudgetUsageIndicator({ onOpenBilling }: BudgetUsageIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const hasUserSession = useAuthStore((state) => Boolean(state.session?.user));
  const summaryQuery = useQuery({
    queryKey: USER_CREDIT_SUMMARY_QUERY_KEY,
    queryFn: getCurrentUserCreditsSummary,
    enabled: hasUserSession,
    staleTime: 60_000,
  });
  const summary = summaryQuery.data;
  const userBudget = summary?.user_budget ?? null;
  const organizationConsumption = summary?.organization_consumption ?? null;
  const budgetRequestPending = summaryQuery.isPending || (summaryQuery.isFetching && !summary);
  const hasUserBudgetLimit = hasMonthlyBudgetLimit(userBudget);
  const userPercent = userBudget
    ? hasUserBudgetLimit
      ? getBudgetPercent(userBudget.spent_this_period_cents, Number(userBudget.monthly_limit_cents))
      : 100
    : null;
  const userPercentLabel = userBudget
    ? `${userPercent ?? 100}%`
    : summaryQuery.isError
      ? "ERR"
      : budgetRequestPending
        ? "..."
        : "—";
  const hasOrganizationConsumption = Boolean(organizationConsumption);
  const userSpentLabel = userBudget
    ? formatBudgetCurrency(userBudget.spent_this_period_cents, userBudget.currency, {
        fixedFractionDigits: true,
      })
    : "—";
  const userLimitLabel =
    userBudget && hasUserBudgetLimit
      ? formatBudgetCurrency(Number(userBudget.monthly_limit_cents), userBudget.currency, {
          fixedFractionDigits: true,
        })
      : null;
  const userUsageLabel = userLimitLabel
    ? `User ${userSpentLabel}/${userLimitLabel}`
    : `User ${userSpentLabel}`;
  const organizationTotalLabel = organizationConsumption
    ? formatBudgetCurrency(organizationConsumption.total_cents, organizationConsumption.currency, {
        fixedFractionDigits: true,
      })
    : null;
  const userTitle = userBudget
    ? userLimitLabel
      ? `User ${userSpentLabel} / ${userLimitLabel}`
      : `User ${userSpentLabel} consumed`
    : summaryQuery.isError
      ? "Budget unavailable"
      : "Loading budget";
  const organizationTitle = organizationConsumption
    ? [
        `Organization ${organizationTotalLabel} consumption`,
        `shared ${formatBudgetCurrency(
          organizationConsumption.organization_shared_cents,
          organizationConsumption.currency,
          { fixedFractionDigits: true },
        )}`,
        `user-attributed ${formatBudgetCurrency(
          organizationConsumption.user_attributed_cents,
          organizationConsumption.currency,
          { fixedFractionDigits: true },
        )}`,
        `unresolved ${formatBudgetCurrency(
          organizationConsumption.unresolved_cents,
          organizationConsumption.currency,
          { fixedFractionDigits: true },
        )}`,
      ].join(" · ")
    : "";

  useEffect(() => {
    if (
      !import.meta.env.DEV ||
      typeof window === "undefined" ||
      window.localStorage.getItem("debug:budget-summary") !== "1"
    ) {
      return;
    }

    console.debug("[budget-summary]", {
      enabled: hasUserSession,
      status: summaryQuery.status,
      fetchStatus: summaryQuery.fetchStatus,
      hasUserBudget: Boolean(userBudget),
      hasOrganizationConsumption,
      error: summaryQuery.error instanceof Error ? summaryQuery.error.message : null,
    });
  }, [
    hasOrganizationConsumption,
    hasUserSession,
    summaryQuery.error,
    summaryQuery.fetchStatus,
    summaryQuery.status,
    userBudget,
  ]);

  return (
    <div
      className={cn(
        "hidden h-9 items-center overflow-hidden rounded-[calc(var(--radius)-6px)] text-foreground/90 transition-[width,background-color] duration-200 sm:flex",
        expanded
          ? hasOrganizationConsumption
            ? "w-[312px] bg-card/50 ring-1 ring-border/55"
            : "w-[238px] bg-card/50 ring-1 ring-border/55"
          : "w-[112px]",
      )}
    >
      <button
        type="button"
        aria-pressed={expanded}
        aria-label={`${userPercentLabel} budget consumed`}
        title={organizationTitle ? `${userTitle} · ${organizationTitle}` : userTitle}
        className="group flex h-full w-[112px] shrink-0 items-center gap-2 rounded-[calc(var(--radius)-6px)] px-2.5 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        <span className="w-7 shrink-0 text-[11px] font-semibold tabular-nums">
          {userPercentLabel}
        </span>
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            hasOrganizationConsumption ? "gap-1" : "justify-center",
          )}
        >
          <BudgetRail
            percent={userPercent}
            title={userTitle}
            compact={hasOrganizationConsumption}
          />
          {organizationConsumption ? (
            <OrganizationConsumptionRail
              consumption={organizationConsumption}
              title={organizationTitle}
            />
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-[11px] font-semibold text-foreground/50"
        >
          $
        </span>
      </button>

      {expanded ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 border-l border-border/55 px-2.5">
          <span className="flex min-w-0 flex-1 flex-col truncate text-[11px] font-medium tabular-nums text-muted-foreground">
            <span className="truncate">
              {userUsageLabel}
            </span>
            {organizationTotalLabel ? (
              <span className="truncate">{`Org ${organizationTotalLabel}`}</span>
            ) : null}
          </span>
          <button
            type="button"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            title="Open billing page"
            aria-label="Open billing page"
            onClick={() => {
              onOpenBilling();
            }}
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const [platformSettingsOpen, setPlatformSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPaletteMode, setSearchPaletteMode] = useState(false);
  const [searchPanelStyle, setSearchPanelStyle] = useState<CSSProperties>();
  const searchShortcutHint =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘K"
      : "Ctrl K";

  const user = useAuthStore((state) => state.session?.user);
  const permissions = user?.permissions ?? [];
  const commandValue = useShellStore((state) => state.commandValue);
  const favoriteSurfaceIds = useShellStore((state) => state.favoriteSurfaceIds);
  const favoriteWorkspaceIds = useShellStore((state) => state.favoriteWorkspaceIds);
  const setCommandValue = useShellStore((state) => state.setCommandValue);
  const toggleSurfaceFavorite = useShellStore((state) => state.toggleSurfaceFavorite);
  const toggleWorkspaceFavorite = useShellStore((state) => state.toggleWorkspaceFavorite);
  const workspaceCanvasMenuHidden = useShellStore((state) => state.workspaceCanvasMenuHidden);
  const setWorkspaceCanvasMenuHidden = useShellStore((state) => state.setWorkspaceCanvasMenuHidden);
  const initializeWorkspaceStudio = useCustomWorkspaceStudioStore((state) => state.initialize);
  const workspaceListItems = useCustomWorkspaceStudioStore((state) => state.workspaceListItems);
  const canAccessOrganizationAdmin = hasOrganizationAdminAccess(user);
  const canAccessPlatformAdminSettings = hasPlatformAdminAccess(user);
  const workspaceRouteParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const requestedWorkspaceId = workspaceRouteParams.get("workspace");
  const workspaceStudioSurfaceId = params.appId === "workspace-studio" ? params.surfaceId : undefined;
  const isDirectWorkspaceRoute =
    env.includeWorkspaces &&
    params.appId === "workspace-studio" &&
    Boolean(workspaceStudioSurfaceId && WORKSPACE_CANVAS_SURFACE_IDS.has(workspaceStudioSurfaceId)) &&
    Boolean(requestedWorkspaceId);

  const accessibleApps = getAccessibleApps(permissions);
  const adminMenuApps = getAccessibleAdminMenuApps(permissions);
  const accessibleSurfaces = getAccessibleSurfaceEntries(permissions);
  const favoriteSurfaces = getFavoriteSurfaceEntries(permissions, favoriteSurfaceIds);
  const favoriteWorkspaces = env.includeWorkspaces
    ? getFavoriteWorkspaceEntries(workspaceListItems, favoriteWorkspaceIds)
    : [];
  const favoriteMenuItems = useMemo<FavoriteMenuItem[]>(
    () => [
      ...favoriteWorkspaces.map((workspace) => ({
        id: workspace.id,
        favoriteId: workspace.favoriteId,
        groupId: workspace.appId,
        groupLabel: workspace.appTitle,
        title: workspace.title,
        kindLabel: workspace.kindLabel,
        path: workspace.path,
      })),
      ...favoriteSurfaces.map((surface) => ({
        id: surface.id,
        favoriteId: getSurfaceFavoriteId(surface.appId, surface.id),
        groupId: surface.appId,
        groupLabel: surface.appTitle,
        title: surface.navLabel ?? surface.title,
        kindLabel: surface.kind,
        path: getSurfacePath(surface),
      })),
    ],
    [favoriteSurfaces, favoriteWorkspaces],
  );
  const currentApp = params.appId ? getAppById(params.appId) : undefined;
  const currentSurface =
    currentApp && params.surfaceId ? getAppSurfaceById(currentApp.id, params.surfaceId) : undefined;
  const currentAppVisible =
    currentApp && accessibleApps.some((app) => app.id === currentApp.id) ? currentApp : undefined;
  const currentAppSurfaces = currentAppVisible
    ? getAccessibleSurfaces(currentAppVisible, permissions)
    : [];
  const currentAppSurfaceGroups = getSurfaceNavigationGroups(currentAppSurfaces);
  const currentDefaultSurface = currentAppVisible
    ? getDefaultSurface(currentAppVisible, permissions)
    : undefined;
  const currentSurfaceVisible =
    currentAppVisible &&
    currentSurface &&
    currentAppSurfaces.some((surface) => surface.id === currentSurface.id)
      ? currentSurface
      : undefined;
  const showWorkspaceCanvasMenuRestore =
    env.includeWorkspaces &&
    params.appId === "workspace-studio" &&
    Boolean(workspaceStudioSurfaceId && WORKSPACE_CANVAS_SURFACE_IDS.has(workspaceStudioSurfaceId)) &&
    Boolean(requestedWorkspaceId) &&
    workspaceRouteParams.get("view") !== "settings" &&
    workspaceCanvasMenuHidden;
  const selectedSurfaceId = currentSurfaceVisible?.id ?? currentDefaultSurface?.id ?? "";
  const normalizedQuery = commandValue.trim().toLowerCase();
  const searchItems = [
    ...accessibleApps.map((app) => ({
      title: app.title,
      subtitle: t("searchResults.openAppSubtitle"),
      to: getAppPath(app.id),
      visible: true,
    })),
    ...accessibleSurfaces.map((surface) => ({
      title: `${surface.appTitle} / ${surface.navLabel ?? surface.title}`,
      subtitle: t("searchResults.openSurfaceSubtitle"),
      to: getSurfacePath(surface),
      visible: true,
    })),
  ].filter((item) => item.visible ?? true);

  const filteredSearchItems = searchItems
    .filter((item) =>
      !normalizedQuery
        ? true
        : `${item.title} ${item.subtitle}`.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 8);
  const showSearchPanel = searchOpen && (searchPaletteMode || normalizedQuery.length > 0);
  const adminMenuActions = [
    ...adminMenuApps.map((app) => ({
      icon: app.icon,
      label: app.title,
      onSelect: () => {
        navigate(getAppPath(app.id));
      },
    })),
  ];

  useEffect(() => {
    function focusSearch() {
      setSearchPaletteMode(true);
      setSearchOpen(true);
      searchRef.current?.focus();
      searchRef.current?.select();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setSearchPaletteMode(false);
        searchRef.current?.blur();
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !searchContainerRef.current?.contains(target) &&
        !searchPanelRef.current?.contains(target)
      ) {
        setSearchOpen(false);
        setSearchPaletteMode(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setSearchPaletteMode(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!showSearchPanel) {
      setSearchPanelStyle(undefined);
      return undefined;
    }

    let frameId = 0;

    function updateSearchPanelPosition() {
      const containerRect = searchContainerRef.current?.getBoundingClientRect();

      if (!containerRect) {
        return;
      }

      const viewportPadding = 12;
      const maxWidth = Math.min(containerRect.width, window.innerWidth - viewportPadding * 2);
      const left = Math.max(
        viewportPadding,
        Math.min(containerRect.left, window.innerWidth - maxWidth - viewportPadding),
      );
      const top = containerRect.bottom + 8;

      setSearchPanelStyle({
        left,
        top,
        width: maxWidth,
      });
    }

    updateSearchPanelPosition();
    frameId = window.requestAnimationFrame(updateSearchPanelPosition);

    window.addEventListener("resize", updateSearchPanelPosition);
    window.addEventListener("scroll", updateSearchPanelPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateSearchPanelPosition);
      window.removeEventListener("scroll", updateSearchPanelPosition, true);
    };
  }, [showSearchPanel]);

  const CurrentAppIcon = currentAppVisible?.icon;

  return (
    <header
      data-theme-chrome="topbar"
      className="flex h-14 items-center justify-between gap-4 border-b border-border/80 bg-topbar/95 px-4 backdrop-blur md:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        {currentAppVisible && CurrentAppIcon ? (
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 min-w-0 px-2.5 text-topbar-foreground"
              onClick={() => {
                navigate(getAppPath(currentAppVisible.id));
              }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/65 text-topbar-foreground">
                <CurrentAppIcon className="h-4 w-4" />
              </span>
              <span className="truncate">{currentAppVisible.title}</span>
            </Button>
            {currentAppSurfaces.length && currentAppVisible.topNavigationStyle !== "hidden" ? (
              <AppSurfaceSelector
                appId={currentAppVisible.id}
                favoriteSurfaceIds={favoriteSurfaceIds}
                value={selectedSurfaceId}
                groups={currentAppSurfaceGroups}
                onToggleFavorite={toggleSurfaceFavorite}
                onSelect={(surfaceId) => {
                  navigate(getAppPath(currentAppVisible.id, surfaceId));
                }}
              />
            ) : null}
            {showWorkspaceCanvasMenuRestore ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Show controls"
                title="Show controls"
                className="relative h-9 w-9 px-0 text-topbar-foreground"
                onClick={() => {
                  setWorkspaceCanvasMenuHidden(false);
                }}
              >
                <span className="absolute inset-0 rounded-full border border-primary/28 bg-primary/8 animate-[pulse_2.2s_ease-in-out_infinite]" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary/90 animate-pulse" />
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/72 text-topbar-foreground shadow-sm">
                  <Rows3 className="h-4 w-4" />
                </span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="hidden min-w-0 flex-1 md:block">
        <div ref={searchContainerRef} className="relative mx-auto max-w-[760px] xl:max-w-[880px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={commandValue}
            onFocus={() => {
              if (normalizedQuery.length > 0) {
                setSearchOpen(true);
              }
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              setCommandValue(nextValue);
              setSearchOpen(searchPaletteMode || nextValue.trim().length > 0);
            }}
            placeholder={t("topbar.searchPlaceholder")}
            className="pl-9 pr-16"
            title={t("topbar.searchShortcutTitle")}
          />
          <span
            className="pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center rounded-md border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            title={t("topbar.searchShortcutTitle")}
            aria-hidden="true"
          >
            {searchShortcutHint}
          </span>
          {showSearchPanel && typeof document !== "undefined"
            ? createPortal(
                <div
                  ref={searchPanelRef}
                  style={searchPanelStyle}
                  className="fixed z-[170] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 shadow-[var(--shadow-panel)] backdrop-blur"
                >
              <div className="border-b border-border/70 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {normalizedQuery ? t("topbar.matchingResults") : t("topbar.suggestedSearch")}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {normalizedQuery
                    ? t("topbar.mockedResultsDescription")
                    : t("topbar.quickEntryDescription")}
                </div>
              </div>
              <div className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
                {filteredSearchItems.length ? (
                  filteredSearchItems.map((item) => (
                    <button
                      key={`${item.to}-${item.title}`}
                      type="button"
                      className="flex w-full flex-col items-start rounded-[calc(var(--radius)-6px)] px-3 py-2.5 text-left transition-colors hover:bg-muted/45"
                      onClick={() => {
                        navigate(item.to);
                        setSearchOpen(false);
                        setSearchPaletteMode(false);
                      }}
                    >
                      <div className="text-sm font-medium text-topbar-foreground">
                        {item.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {item.subtitle}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[calc(var(--radius)-6px)] px-3 py-4">
                    <div className="text-sm font-medium text-topbar-foreground">
                      {t("topbar.noMatchingResults")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t("topbar.noMatchingResultsSubtitle")}
                    </div>
                  </div>
                )}
              </div>
                </div>,
                document.body,
              )
            : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {env.useMockData ? (
          <Badge variant="neutral">{t("topbar.dataModeMock")}</Badge>
        ) : null}

        <BudgetUsageIndicator
          onOpenBilling={() => {
            navigate(getAppPath("admin", "billing-details"));
          }}
        />

        <FavoriteSurfacesMenu
          items={favoriteMenuItems}
          onOpenChange={(open) => {
            if (
              !open ||
              !env.includeWorkspaces ||
              !user?.id ||
              favoriteWorkspaceIds.length === 0 ||
              isDirectWorkspaceRoute
            ) {
              return;
            }

            void initializeWorkspaceStudio(user.id, { preloadList: true });
          }}
          onSelect={(path) => {
            navigate(path);
          }}
          onToggleFavorite={(favoriteId) => {
            if (isWorkspaceFavoriteId(favoriteId)) {
              toggleWorkspaceFavorite(favoriteId);
              return;
            }

            toggleSurfaceFavorite(favoriteId);
          }}
        />

        <ThemeMenu />

        <NotificationsMenu />

        {canAccessOrganizationAdmin ? (
          <>
            <AdminMenu
              actions={adminMenuActions}
              align="end"
              placement="bottom"
              triggerLabel={t("userMenu.openAdmin")}
              triggerClassName="min-w-0 gap-2 rounded-md border border-border/80 bg-card/70 px-3 py-1.5 text-left text-topbar-foreground transition-colors hover:bg-muted/50"
              triggerContent={
                <>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("userMenu.admin")}</span>
                </>
              }
            />
            {canAccessPlatformAdminSettings ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-w-0 gap-2 rounded-md border border-border/80 bg-card/70 px-3 py-1.5 text-topbar-foreground transition-colors hover:bg-muted/50"
                onClick={() => {
                  setPlatformSettingsOpen(true);
                }}
              >
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t("userMenu.adminSettings")}</span>
              </Button>
            ) : null}
            <SettingsDialog
              mode="platform"
              open={platformSettingsOpen}
              user={user ?? undefined}
              onClose={() => {
                setPlatformSettingsOpen(false);
              }}
            />
          </>
        ) : null}
      </div>

    </header>
  );
}
