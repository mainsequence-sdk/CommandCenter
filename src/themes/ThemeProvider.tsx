import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { appRegistry } from "@/app/registry";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import { readCachedCurrentCommandCenterPreferences } from "@/preferences/api";
import {
  applyThemePresetToRoot,
  type ResolvedThemeDataVizPalette,
  resolveThemeDataVizPalette,
  type ThemePreset,
  type ThemeSurfaceHierarchy,
  type ThemeTightness,
  type ThemeTokenKey,
  type ThemeTokens,
} from "@dev-mainsequence/command-center-themes";
import {
  ThemeContext,
  type ThemeContextValue,
  useOptionalTheme,
  useTheme,
  useThemeDataViz,
} from "@/themes/ThemeContext";
const backendPreferencesEnabled =
  !env.useMockData && Boolean(commandCenterConfig.preferences.url.trim());
export const themeStorageKey = "ms.command-center.theme";
export const DEFAULT_THEME_ID = "main-sequence-space";

function resolveDefaultThemeId(availableThemes: ThemePreset[]) {
  return (
    availableThemes.find((theme) => theme.id === DEFAULT_THEME_ID)?.id ??
    availableThemes[0]?.id ??
    DEFAULT_THEME_ID
  );
}

function resolveInitialThemeId(availableThemes: ThemePreset[], defaultThemeId: string) {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return defaultThemeId;
  }

  const storedThemeId = backendPreferencesEnabled
    ? readCachedCurrentCommandCenterPreferences()?.themeId?.trim()
    : window.localStorage.getItem(themeStorageKey)?.trim();

  if (!storedThemeId) {
    return defaultThemeId;
  }

  return availableThemes.some((theme) => theme.id === storedThemeId)
    ? storedThemeId
    : defaultThemeId;
}

function applyThemeDocumentState({
  activeTheme,
  resolvedTokens,
  tightness,
  surfaceHierarchy,
}: {
  activeTheme: ThemePreset;
  resolvedTokens: ThemeTokens;
  tightness: ThemeTightness;
  surfaceHierarchy: ThemeSurfaceHierarchy;
}) {
  if (typeof document === "undefined") {
    return;
  }

  applyThemePresetToRoot(document.documentElement, {
    theme: activeTheme,
    resolvedTokens,
    tightness,
    surfaceHierarchy,
  });
}

export function initializeDocumentTheme() {
  const availableThemes = appRegistry.themes;
  const defaultThemeId = resolveDefaultThemeId(availableThemes);
  const themeId = resolveInitialThemeId(availableThemes, defaultThemeId);
  const activeTheme =
    availableThemes.find((theme) => theme.id === themeId) ??
    availableThemes.find((theme) => theme.id === defaultThemeId) ??
    availableThemes[0];

  if (!activeTheme) {
    return;
  }

  applyThemeDocumentState({
    activeTheme,
    resolvedTokens: activeTheme.tokens,
    tightness: activeTheme.tightness,
    surfaceHierarchy: activeTheme.surfaceHierarchy,
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const availableThemes = appRegistry.themes;
  const defaultThemeId = resolveDefaultThemeId(availableThemes);
  const [themeId, setThemeId] = useState(() =>
    resolveInitialThemeId(availableThemes, defaultThemeId),
  );
  const [overrides, setOverrides] = useState<Partial<ThemeTokens>>({});
  const [tightnessOverride, setTightnessOverride] = useState<ThemeTightness | null>(null);
  const [surfaceHierarchyOverride, setSurfaceHierarchyOverride] = useState<ThemeSurfaceHierarchy | null>(null);

  const activeTheme =
    availableThemes.find((theme) => theme.id === themeId) ??
    availableThemes.find((theme) => theme.id === defaultThemeId) ??
    availableThemes[0];
  const tightness = tightnessOverride ?? activeTheme.tightness;
  const surfaceHierarchy = surfaceHierarchyOverride ?? activeTheme.surfaceHierarchy;
  const resolvedTokens = useMemo(
    () =>
      ({
        ...activeTheme.tokens,
        ...overrides,
      }) as ThemeTokens,
    [activeTheme, overrides],
  );
  const resolvedDataViz = useMemo(
    () => resolveThemeDataVizPalette(activeTheme, resolvedTokens),
    [activeTheme, resolvedTokens],
  );

  useEffect(() => {
    applyThemeDocumentState({
      activeTheme,
      resolvedTokens,
      tightness,
      surfaceHierarchy,
    });
  }, [activeTheme, resolvedTokens, surfaceHierarchy, tightness]);

  useEffect(() => {
    if (
      backendPreferencesEnabled ||
      typeof window === "undefined" ||
      typeof window.localStorage === "undefined"
    ) {
      return;
    }

    window.localStorage.setItem(themeStorageKey, activeTheme.id);
  }, [activeTheme.id]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      availableThemes,
      activeTheme,
      themeId: activeTheme.id,
      resolvedTokens,
      resolvedDataViz,
      tightness,
      surfaceHierarchy,
      overrides,
      setThemeById(id) {
        setThemeId(id);
        setOverrides({});
        setTightnessOverride(null);
        setSurfaceHierarchyOverride(null);
      },
      cycleTheme() {
        const currentIndex = availableThemes.findIndex(
          (theme) => theme.id === activeTheme.id,
        );
        const nextIndex =
          currentIndex === -1 || currentIndex === availableThemes.length - 1
            ? 0
            : currentIndex + 1;
        setThemeId(availableThemes[nextIndex]?.id ?? activeTheme.id);
        setOverrides({});
        setTightnessOverride(null);
        setSurfaceHierarchyOverride(null);
      },
      setTightness(nextTightness) {
        setTightnessOverride(
          nextTightness === activeTheme.tightness ? null : nextTightness,
        );
      },
      setSurfaceHierarchy(nextSurfaceHierarchy) {
        setSurfaceHierarchyOverride(
          nextSurfaceHierarchy === activeTheme.surfaceHierarchy ? null : nextSurfaceHierarchy,
        );
      },
      updateToken(key, value) {
        setOverrides((current) => ({
          ...current,
          [key]: value,
        }));
      },
      resetOverrides() {
        setOverrides({});
        setTightnessOverride(null);
        setSurfaceHierarchyOverride(null);
      },
    }),
    [activeTheme, availableThemes, overrides, resolvedDataViz, resolvedTokens, surfaceHierarchy, tightness],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export { useOptionalTheme, useTheme, useThemeDataViz };
