import { getThemeSurfaceHierarchyMetrics } from "./surface-hierarchy.js";
import { getThemeTightnessMetrics } from "./tightness.js";
import {
  themeTokenKeys,
  type ThemePreset,
  type ThemeSurfaceHierarchy,
  type ThemeTightness,
  type ThemeTokens,
} from "./types.js";

export interface ApplyThemePresetToRootInput {
  theme: ThemePreset;
  resolvedTokens?: ThemeTokens;
  tightness?: ThemeTightness;
  surfaceHierarchy?: ThemeSurfaceHierarchy;
}

export function applyThemePresetToRoot(
  root: HTMLElement,
  {
    theme,
    resolvedTokens = theme.tokens,
    tightness = theme.tightness,
    surfaceHierarchy = theme.surfaceHierarchy,
  }: ApplyThemePresetToRootInput,
) {
  const tightnessMetrics = getThemeTightnessMetrics(tightness);
  const surfaceHierarchyMetrics = getThemeSurfaceHierarchyMetrics(surfaceHierarchy);

  root.dataset.theme = theme.id;
  root.classList.toggle("dark", theme.mode === "dark");

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
}
