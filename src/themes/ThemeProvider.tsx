import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { appRegistry } from "@/app/registry";
import { getThemeSurfaceHierarchyMetrics } from "@/themes/surface-hierarchy";
import { getThemeTightnessMetrics } from "@/themes/tightness";
import {
  themeTokenKeys,
  type ThemePreset,
  type ThemeSurfaceHierarchy,
  type ThemeTightness,
  type ThemeTokenKey,
  type ThemeTokens,
} from "@/themes/types";

interface ThemeContextValue {
  availableThemes: ThemePreset[];
  activeTheme: ThemePreset;
  themeId: string;
  resolvedTokens: ThemeTokens;
  tightness: ThemeTightness;
  surfaceHierarchy: ThemeSurfaceHierarchy;
  overrides: Partial<ThemeTokens>;
  setThemeById: (id: string) => void;
  cycleTheme: () => void;
  setTightness: (tightness: ThemeTightness) => void;
  setSurfaceHierarchy: (surfaceHierarchy: ThemeSurfaceHierarchy) => void;
  updateToken: (key: ThemeTokenKey, value: string) => void;
  resetOverrides: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const DEFAULT_THEME_ID = "main-sequence-space";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const availableThemes = appRegistry.themes;
  const defaultThemeId =
    availableThemes.find((theme) => theme.id === DEFAULT_THEME_ID)?.id ??
    availableThemes[0]?.id ??
    DEFAULT_THEME_ID;
  const [themeId, setThemeId] = useState(defaultThemeId);
  const [overrides, setOverrides] = useState<Partial<ThemeTokens>>({});
  const [tightnessOverride, setTightnessOverride] = useState<ThemeTightness | null>(null);
  const [surfaceHierarchyOverride, setSurfaceHierarchyOverride] = useState<ThemeSurfaceHierarchy | null>(null);

  const activeTheme =
    availableThemes.find((theme) => theme.id === themeId) ??
    availableThemes.find((theme) => theme.id === defaultThemeId) ??
    availableThemes[0];
  const tightness = tightnessOverride ?? activeTheme.tightness;
  const surfaceHierarchy = surfaceHierarchyOverride ?? activeTheme.surfaceHierarchy;
  const tightnessMetrics = useMemo(
    () => getThemeTightnessMetrics(tightness),
    [tightness],
  );
  const surfaceHierarchyMetrics = useMemo(
    () => getThemeSurfaceHierarchyMetrics(surfaceHierarchy),
    [surfaceHierarchy],
  );

  const resolvedTokens = useMemo(
    () =>
      ({
        ...activeTheme.tokens,
        ...overrides,
      }) as ThemeTokens,
    [activeTheme, overrides],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = activeTheme.id;
    root.classList.toggle("dark", activeTheme.mode === "dark");

    themeTokenKeys.forEach((token) => {
      root.style.setProperty(`--${token}`, resolvedTokens[token]);
    });
    root.dataset.tightness = tightness;
    root.style.setProperty(
      "--table-standard-cell-padding-y",
      tightnessMetrics.table.standardCellPaddingY,
    );
    root.style.setProperty(
      "--table-standard-header-padding-y",
      tightnessMetrics.table.standardHeaderPaddingY,
    );
    root.style.setProperty("--table-row-gap-y", tightnessMetrics.table.rowGapY);
    root.style.setProperty("--table-font-size", tightnessMetrics.table.fontSize);
    root.style.setProperty("--table-meta-font-size", tightnessMetrics.table.metaFontSize);
    root.style.setProperty(
      "--table-compact-cell-padding-y",
      tightnessMetrics.table.compactCellPaddingY,
    );
    root.style.setProperty(
      "--table-compact-header-padding-y",
      tightnessMetrics.table.compactHeaderPaddingY,
    );
    root.style.setProperty("--font-size-page-title", tightnessMetrics.typography.pageTitleSize);
    root.style.setProperty("--font-size-section-title", tightnessMetrics.typography.sectionTitleSize);
    root.style.setProperty("--font-size-body", tightnessMetrics.typography.bodySize);
    root.style.setProperty("--font-size-body-sm", tightnessMetrics.typography.bodySmSize);
    root.style.setProperty("--font-size-body-xs", tightnessMetrics.typography.bodyXsSize);
    root.style.setProperty("--line-height-body", tightnessMetrics.typography.bodyLineHeight);
    root.style.setProperty("--font-size-markdown-h1", tightnessMetrics.typography.markdownH1Size);
    root.style.setProperty("--font-size-markdown-h2", tightnessMetrics.typography.markdownH2Size);
    root.style.setProperty("--font-size-markdown-h3", tightnessMetrics.typography.markdownH3Size);
    root.style.setProperty("--font-size-markdown-h4", tightnessMetrics.typography.markdownH4Size);
    root.style.setProperty("--summary-stat-grid-gap", tightnessMetrics.summary.statGridGap);
    root.style.setProperty("--summary-highlight-gap", tightnessMetrics.summary.highlightGap);
    root.style.setProperty(
      "--summary-stat-card-padding-x",
      tightnessMetrics.summary.statCardPaddingX,
    );
    root.style.setProperty(
      "--summary-stat-card-padding-y",
      tightnessMetrics.summary.statCardPaddingY,
    );
    root.style.setProperty("--summary-stat-label-size", tightnessMetrics.summary.statLabelSize);
    root.style.setProperty("--summary-stat-value-size", tightnessMetrics.summary.statValueSize);
    root.style.setProperty("--summary-stat-info-size", tightnessMetrics.summary.statInfoSize);
    root.style.setProperty(
      "--summary-highlight-card-padding-x",
      tightnessMetrics.summary.highlightCardPaddingX,
    );
    root.style.setProperty(
      "--summary-highlight-card-padding-y",
      tightnessMetrics.summary.highlightCardPaddingY,
    );
    root.style.setProperty(
      "--summary-stat-value-margin-top",
      tightnessMetrics.summary.statValueMarginTop,
    );
    root.style.setProperty(
      "--summary-stat-info-margin-top",
      tightnessMetrics.summary.statInfoMarginTop,
    );
    root.style.setProperty(
      "--summary-highlight-value-margin-top",
      tightnessMetrics.summary.highlightValueMarginTop,
    );
    root.style.setProperty(
      "--summary-highlight-meta-margin-top",
      tightnessMetrics.summary.highlightMetaMarginTop,
    );
    root.dataset.surfaceHierarchy = surfaceHierarchy;
    root.style.setProperty("--card-nested-border-color", surfaceHierarchyMetrics.nestedCardBorderColor);
    root.style.setProperty("--card-nested-background", surfaceHierarchyMetrics.nestedCardBackground);
    root.style.setProperty("--card-nested-shadow", surfaceHierarchyMetrics.nestedCardShadow);
  }, [activeTheme, resolvedTokens, surfaceHierarchy, surfaceHierarchyMetrics, tightness, tightnessMetrics]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      availableThemes,
      activeTheme,
      themeId: activeTheme.id,
      resolvedTokens,
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
    [activeTheme, availableThemes, overrides, resolvedTokens, surfaceHierarchy, tightness],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}

export function useOptionalTheme() {
  return useContext(ThemeContext);
}
