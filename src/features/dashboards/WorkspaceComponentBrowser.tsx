import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";

import { BookOpenText, Clock3, GripVertical, LayoutTemplate, Plus, Search, Star, X } from "lucide-react";

import { appRegistry } from "@/app/registry";
import { hasAllPermissions } from "@/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, titleCase } from "@/lib/utils";
import type { WidgetDefinition } from "@/widgets/types";

import {
  loadWidgetCatalogPreferences,
  pushRecentWidgetId,
  saveWidgetCatalogPreferences,
} from "./widget-catalog-preferences";
import { useWorkspaceStudioSurfaceConfig } from "./workspace-studio-surface-config";

type CatalogScope = "browse" | "favorites" | "recent";

interface CatalogSection {
  id: string;
  title: string;
  description?: string;
  widgets: WidgetDefinition[];
}

function getWidgetCatalogSearchScore(widget: WidgetDefinition, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return 0;
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const title = widget.title.toLowerCase();
  const description = widget.description.toLowerCase();
  const category = widget.category.toLowerCase();
  const kind = widget.kind.toLowerCase();
  const source = widget.source.toLowerCase();
  const tags = widget.tags?.join(" ").toLowerCase() ?? "";

  let score = 0;

  for (const term of terms) {
    let termScore = 0;

    if (title === term) {
      termScore = Math.max(termScore, 140);
    } else if (title.startsWith(term)) {
      termScore = Math.max(termScore, 100);
    } else if (title.includes(term)) {
      termScore = Math.max(termScore, 70);
    }

    if (tags.includes(term)) {
      termScore = Math.max(termScore, 50);
    }

    if (category.includes(term) || kind.includes(term) || source.includes(term)) {
      termScore = Math.max(termScore, 35);
    }

    if (description.includes(term)) {
      termScore = Math.max(termScore, 22);
    }

    if (termScore === 0) {
      return -1;
    }

    score += termScore;
  }

  return score;
}

function CatalogScopeButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/70 bg-background/35 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
      onClick={onClick}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] tracking-[0.12em]",
          active ? "bg-primary/14 text-primary" : "bg-muted/70 text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CatalogSectionHeader({
  title,
  count,
  description,
}: {
  title: string;
  count: number;
  description?: string;
}) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
          {title}
        </div>
        {description ? (
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <Badge variant="neutral" className="shrink-0 px-2 py-0.5 text-[10px] tracking-[0.12em]">
        {count}
      </Badge>
    </div>
  );
}

function CatalogWidgetRow({
  draggable,
  favorite,
  onAdd,
  onPointerDown,
  onToggleFavorite,
  widget,
}: {
  draggable: boolean;
  favorite: boolean;
  onAdd: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleFavorite: () => void;
  widget: WidgetDefinition;
}) {
  const sizeLabel = `${widget.defaultSize.w} x ${widget.defaultSize.h}`;

  return (
    <div
      className={cn(
        "rounded-[18px] border border-border/70 bg-background/35 px-3 py-3 transition-colors hover:bg-background/55",
        draggable ? "cursor-grab active:cursor-grabbing" : undefined,
      )}
      onPointerDown={onPointerDown}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
            favorite
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/70 bg-background/35 text-muted-foreground hover:text-foreground",
          )}
          aria-label={favorite ? `Remove ${widget.title} from favorites` : `Favorite ${widget.title}`}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Star className={cn("h-4 w-4", favorite ? "fill-current" : undefined)} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {draggable ? <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
            <div className="min-w-0 truncate text-sm font-medium text-foreground">{widget.title}</div>
            <Badge variant="neutral" className="shrink-0 px-2 py-0.5 text-[10px] tracking-[0.12em]">
              {titleCase(widget.kind)}
            </Badge>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{widget.description}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>{widget.category}</span>
            <span>{titleCase(widget.source)}</span>
            <span>{sizeLabel}</span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function WorkspaceComponentBrowser({
  open,
  permissions,
  userId,
  topOffsetClassName,
  enableDrag = false,
  onAddWidget,
  onOpenSavedWidgets,
  onOpenChange,
  onWidgetPointerStart,
}: {
  open: boolean;
  permissions: string[];
  userId: string | number | null;
  topOffsetClassName: string;
  enableDrag?: boolean;
  onAddWidget: (widget: WidgetDefinition) => void;
  onOpenSavedWidgets?: () => void;
  onOpenChange: (open: boolean) => void;
  onWidgetPointerStart?: (widget: WidgetDefinition, event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { allowedWidgetIds } = useWorkspaceStudioSurfaceConfig();
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("all");
  const [catalogKindFilter, setCatalogKindFilter] = useState<WidgetDefinition["kind"] | "all">("all");
  const [catalogSourceFilter, setCatalogSourceFilter] = useState("all");
  const [catalogScope, setCatalogScope] = useState<CatalogScope>("browse");
  const [favoriteWidgetIds, setFavoriteWidgetIds] = useState<string[]>([]);
  const [recentWidgetIds, setRecentWidgetIds] = useState<string[]>([]);
  const allowedWidgetIdSet = useMemo(
    () => (allowedWidgetIds ? new Set(allowedWidgetIds) : null),
    [allowedWidgetIds],
  );

  const allowedWidgets = useMemo(
    () =>
      appRegistry.widgets.filter((widget) =>
        hasAllPermissions(permissions, widget.requiredPermissions ?? []) &&
        (!allowedWidgetIdSet || allowedWidgetIdSet.has(widget.id)),
      ),
    [allowedWidgetIdSet, permissions],
  );
  const widgetMap = useMemo(
    () => new Map(allowedWidgets.map((widget) => [widget.id, widget])),
    [allowedWidgets],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(allowedWidgets.map((widget) => widget.category))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [allowedWidgets],
  );
  const kindOptions = useMemo(
    () =>
      Array.from(new Set(allowedWidgets.map((widget) => widget.kind))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [allowedWidgets],
  );
  const sourceOptions = useMemo(
    () =>
      Array.from(new Set(allowedWidgets.map((widget) => widget.source))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [allowedWidgets],
  );
  const favoriteWidgetSet = useMemo(() => new Set(favoriteWidgetIds), [favoriteWidgetIds]);
  const recentWidgetIndexMap = useMemo(
    () => new Map(recentWidgetIds.map((widgetId, index) => [widgetId, index])),
    [recentWidgetIds],
  );
  const favoriteWidgets = useMemo(
    () =>
      favoriteWidgetIds
        .map((widgetId) => widgetMap.get(widgetId))
        .filter((widget): widget is WidgetDefinition => Boolean(widget)),
    [favoriteWidgetIds, widgetMap],
  );
  const recentWidgets = useMemo(
    () =>
      recentWidgetIds
        .map((widgetId) => widgetMap.get(widgetId))
        .filter((widget): widget is WidgetDefinition => Boolean(widget)),
    [recentWidgetIds, widgetMap],
  );
  const catalogBaseWidgets = useMemo(() => {
    if (catalogScope === "favorites") {
      return favoriteWidgets;
    }

    if (catalogScope === "recent") {
      return recentWidgets;
    }

    return allowedWidgets;
  }, [allowedWidgets, catalogScope, favoriteWidgets, recentWidgets]);
  const filteredWidgets = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    const hasCategoryFilter = catalogCategoryFilter !== "all";
    const hasKindFilter = catalogKindFilter !== "all";
    const hasSourceFilter = catalogSourceFilter !== "all";

    return catalogBaseWidgets
      .map((widget) => ({
        widget,
        score: getWidgetCatalogSearchScore(widget, query),
      }))
      .filter(({ score, widget }) => {
        if (score < 0) {
          return false;
        }

        if (hasCategoryFilter && widget.category !== catalogCategoryFilter) {
          return false;
        }

        if (hasKindFilter && widget.kind !== catalogKindFilter) {
          return false;
        }

        if (hasSourceFilter && widget.source !== catalogSourceFilter) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const scoreDifference = right.score - left.score;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        const favoriteDifference =
          Number(favoriteWidgetSet.has(right.widget.id)) - Number(favoriteWidgetSet.has(left.widget.id));

        if (favoriteDifference !== 0) {
          return favoriteDifference;
        }

        const leftRecentIndex = recentWidgetIndexMap.get(left.widget.id) ?? Number.MAX_SAFE_INTEGER;
        const rightRecentIndex = recentWidgetIndexMap.get(right.widget.id) ?? Number.MAX_SAFE_INTEGER;

        if (leftRecentIndex !== rightRecentIndex) {
          return leftRecentIndex - rightRecentIndex;
        }

        return left.widget.title.localeCompare(right.widget.title);
      })
      .map(({ widget }) => widget);
  }, [
    catalogBaseWidgets,
    catalogCategoryFilter,
    catalogKindFilter,
    catalogQuery,
    catalogSourceFilter,
    favoriteWidgetSet,
    recentWidgetIndexMap,
  ]);
  const catalogFiltersActive =
    catalogCategoryFilter !== "all" || catalogKindFilter !== "all" || catalogSourceFilter !== "all";
  const catalogSearchActive = catalogQuery.trim().length > 0;
  const catalogSections = useMemo<CatalogSection[]>(() => {
    if (catalogScope === "favorites") {
      return [
        {
          id: "favorites",
          title: "Favorites",
          description: "Pin the components you reach for most often.",
          widgets: filteredWidgets,
        },
      ];
    }

    if (catalogScope === "recent") {
      return [
        {
          id: "recent",
          title: "Recently used",
          description: "Components you placed most recently.",
          widgets: filteredWidgets,
        },
      ];
    }

    if (catalogSearchActive || catalogFiltersActive) {
      return [
        {
          id: "results",
          title: "Results",
          description: "Filtered components for the current search.",
          widgets: filteredWidgets,
        },
      ];
    }

    const sections: CatalogSection[] = [];

    if (favoriteWidgets.length > 0) {
      sections.push({
        id: "favorites",
        title: "Favorites",
        description: "Pinned components stay at the top for quick access.",
        widgets: favoriteWidgets,
      });
    }

    if (recentWidgets.length > 0) {
      sections.push({
        id: "recent",
        title: "Recently used",
        description: "Latest components added to a workspace.",
        widgets: recentWidgets,
      });
    }

    const widgetsByCategory = allowedWidgets.reduce<Map<string, WidgetDefinition[]>>((groups, widget) => {
      const current = groups.get(widget.category) ?? [];
      current.push(widget);
      groups.set(widget.category, current);
      return groups;
    }, new Map());

    Array.from(widgetsByCategory.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([category, widgets]) => {
        sections.push({
          id: `category:${category}`,
          title: category,
          widgets: [...widgets].sort((left, right) => {
            const leftFavorite = favoriteWidgetSet.has(left.id);
            const rightFavorite = favoriteWidgetSet.has(right.id);

            if (leftFavorite !== rightFavorite) {
              return Number(rightFavorite) - Number(leftFavorite);
            }

            return left.title.localeCompare(right.title);
          }),
        });
      });

    return sections;
  }, [
    allowedWidgets,
    catalogFiltersActive,
    catalogScope,
    catalogSearchActive,
    favoriteWidgetSet,
    favoriteWidgets,
    filteredWidgets,
    recentWidgets,
  ]);

  useEffect(() => {
    if (!userId) {
      setFavoriteWidgetIds([]);
      setRecentWidgetIds([]);
      return;
    }

    const preferences = loadWidgetCatalogPreferences(
      userId,
      allowedWidgets.map((widget) => widget.id),
    );

    setFavoriteWidgetIds(preferences.favoriteWidgetIds);
    setRecentWidgetIds(preferences.recentWidgetIds);
  }, [allowedWidgets, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    saveWidgetCatalogPreferences(userId, {
      favoriteWidgetIds,
      recentWidgetIds,
    });
  }, [favoriteWidgetIds, recentWidgetIds, userId]);

  function handleCatalogFavoriteToggle(widgetId: string) {
    setFavoriteWidgetIds((current) =>
      current.includes(widgetId)
        ? current.filter((entry) => entry !== widgetId)
        : [widgetId, ...current],
    );
  }

  function handleCatalogFiltersReset() {
    setCatalogQuery("");
    setCatalogCategoryFilter("all");
    setCatalogKindFilter("all");
    setCatalogSourceFilter("all");
  }

  function handleCatalogAdd(widget: WidgetDefinition) {
    setRecentWidgetIds((current) => pushRecentWidgetId(current, widget.id));
    onAddWidget(widget);
  }

  return (
    <aside
      className={cn(
        "absolute left-4 bottom-4 z-30 w-[420px] max-w-[calc(100%-2rem)] overflow-hidden rounded-[24px] border border-border/70 bg-card/92 shadow-[var(--shadow-panel)] backdrop-blur-xl transition-[top,transform] duration-200",
        topOffsetClassName,
        open ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-border/70 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Components</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {enableDrag
                  ? "Search, filter, favorite, or drag directly onto the canvas."
                  : "Search, filter, favorite, and add components directly from graph mode."}
              </div>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label="Close components"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="border-border/70 bg-background/45 pl-9"
              value={catalogQuery}
              onChange={(event) => {
                setCatalogQuery(event.target.value);
              }}
              placeholder="Search by name, category, source, or tag"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <CatalogScopeButton
              active={catalogScope === "browse"}
              count={allowedWidgets.length}
              label="Browse"
              onClick={() => {
                setCatalogScope("browse");
              }}
            />
            <CatalogScopeButton
              active={catalogScope === "favorites"}
              count={favoriteWidgets.length}
              label="Favorites"
              onClick={() => {
                setCatalogScope("favorites");
              }}
            />
            <CatalogScopeButton
              active={catalogScope === "recent"}
              count={recentWidgets.length}
              label="Recent"
              onClick={() => {
                setCatalogScope("recent");
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select
              value={catalogCategoryFilter}
              onChange={(event) => {
                setCatalogCategoryFilter(event.target.value);
              }}
            >
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
            <Select
              value={catalogKindFilter}
              onChange={(event) => {
                setCatalogKindFilter(event.target.value as WidgetDefinition["kind"] | "all");
              }}
            >
              <option value="all">All kinds</option>
              {kindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {titleCase(kind)}
                </option>
              ))}
            </Select>
            <Select
              value={catalogSourceFilter}
              onChange={(event) => {
                setCatalogSourceFilter(event.target.value);
              }}
            >
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {titleCase(source)}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {catalogSearchActive || catalogFiltersActive ? (
                <span>{filteredWidgets.length} matching components</span>
              ) : (
                <span>{allowedWidgets.length} available components</span>
              )}
            </div>
            {catalogSearchActive || catalogFiltersActive ? (
              <Button size="sm" variant="ghost" onClick={handleCatalogFiltersReset}>
                Clear filters
              </Button>
            ) : null}
          </div>

          {onOpenSavedWidgets ? (
            <div className="mt-3 rounded-[18px] border border-border/70 bg-background/32 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">Saved widgets</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Open the saved widgets library page to browse and manage reusable widget instances and groups.
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={onOpenSavedWidgets}>
                  <BookOpenText className="h-3.5 w-3.5" />
                  Open
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {catalogSections.some((section) => section.widgets.length > 0) ? (
            <div className="space-y-5">
              {catalogSections.map((section) =>
                section.widgets.length > 0 ? (
                  <section key={section.id}>
                    <CatalogSectionHeader
                      title={section.title}
                      description={section.description}
                      count={section.widgets.length}
                    />
                    <div className="space-y-2">
                      {section.widgets.map((widget) => (
                        <CatalogWidgetRow
                          key={`${section.id}:${widget.id}`}
                          widget={widget}
                          draggable={enableDrag}
                          favorite={favoriteWidgetSet.has(widget.id)}
                          onToggleFavorite={() => {
                            handleCatalogFavoriteToggle(widget.id);
                          }}
                          onAdd={() => {
                            handleCatalogAdd(widget);
                          }}
                          onPointerDown={
                            onWidgetPointerStart
                              ? (event) => {
                                  onWidgetPointerStart(widget, event);
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </section>
                ) : null,
              )}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-border/70 bg-background/35 p-5 text-center">
              <div className="text-sm font-medium text-foreground">
                {allowedWidgets.length === 0
                  ? "No components are available for this workspace."
                  : catalogScope === "favorites"
                    ? "No favorite components yet."
                    : catalogScope === "recent"
                      ? "No recent components yet."
                      : "No components match the current search."}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {allowedWidgets.length === 0
                  ? "Your current permissions do not expose any widget definitions here."
                  : catalogScope === "favorites"
                    ? "Use the star on a component to pin it for faster access."
                    : catalogScope === "recent"
                      ? "Components you add to a workspace will appear here."
                      : "Try another search or clear the active filters."}
              </div>
              {catalogSearchActive || catalogFiltersActive ? (
                <Button className="mt-4" size="sm" variant="outline" onClick={handleCatalogFiltersReset}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
