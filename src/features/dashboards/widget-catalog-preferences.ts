import {
  normalizeWidgetTypeId,
  normalizeWidgetTypeIds,
} from "@/widgets/widget-type-normalization";

const WIDGET_CATALOG_PREFERENCES_STORAGE_KEY = "command-center.widget-catalog";
const MAX_RECENT_WIDGET_IDS = 12;

export interface WidgetCatalogPreferences {
  favoriteWidgetIds: string[];
  recentWidgetIds: string[];
}

function getStorageKey(userId: string | number) {
  return `${WIDGET_CATALOG_PREFERENCES_STORAGE_KEY}.${String(userId)}`;
}

function normalizeIds(values: unknown, allowedWidgetIds: Set<string>) {
  if (!Array.isArray(values)) {
    return [];
  }

  return normalizeWidgetTypeIds(
    values
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0 && allowedWidgetIds.has(normalizeWidgetTypeId(value))),
  );
}

export function loadWidgetCatalogPreferences(
  userId: string | number,
  allowedWidgetIds: Iterable<string>,
): WidgetCatalogPreferences {
  if (typeof window === "undefined") {
    return {
      favoriteWidgetIds: [],
      recentWidgetIds: [],
    };
  }

  const allowedSet = new Set(allowedWidgetIds);

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));

    if (!raw) {
      return {
        favoriteWidgetIds: [],
        recentWidgetIds: [],
      };
    }

    const parsed = JSON.parse(raw) as {
      favoriteWidgetIds?: unknown;
      recentWidgetIds?: unknown;
    };

    return {
      favoriteWidgetIds: normalizeIds(parsed.favoriteWidgetIds, allowedSet),
      recentWidgetIds: normalizeIds(parsed.recentWidgetIds, allowedSet),
    };
  } catch {
    return {
      favoriteWidgetIds: [],
      recentWidgetIds: [],
    };
  }
}

export function saveWidgetCatalogPreferences(
  userId: string | number,
  preferences: WidgetCatalogPreferences,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(preferences));
  } catch {
    // Ignore storage write failures so the catalog UI stays usable.
  }
}

export function pushRecentWidgetId(recentWidgetIds: string[], widgetId: string) {
  const normalizedWidgetId = normalizeWidgetTypeId(widgetId);
  return [normalizedWidgetId, ...recentWidgetIds.filter((entry) => entry !== normalizedWidgetId)].slice(
    0,
    MAX_RECENT_WIDGET_IDS,
  );
}
