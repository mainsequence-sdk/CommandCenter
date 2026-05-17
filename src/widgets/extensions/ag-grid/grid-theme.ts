import { themeQuartz, type Theme } from "ag-grid-community";

import { withAlpha } from "@/lib/color";
import type { ThemeTightnessMetrics } from "@/themes/tightness";
import type { ThemeTokens } from "@/themes/types";

export function createAgGridTerminalTheme(
  tokens: ThemeTokens,
  metrics: ThemeTightnessMetrics["table"],
  options: {
    transparentSurface?: boolean;
  } = {},
): Theme {
  const backgroundColor = options.transparentSurface
    ? "transparent"
    : withAlpha(tokens.card, 0.98);
  const chromeBackgroundColor = options.transparentSurface
    ? "transparent"
    : withAlpha(tokens.card, 0.94);
  const dataBackgroundColor = options.transparentSurface
    ? "transparent"
    : withAlpha(tokens.card, 0.98);

  return themeQuartz.withParams({
    backgroundColor,
    foregroundColor: tokens.foreground,
    textColor: tokens.foreground,
    cellTextColor: tokens.foreground,
    headerTextColor: tokens.foreground,
    headerBackgroundColor: options.transparentSurface ? "transparent" : withAlpha(tokens.muted, 0.82),
    chromeBackgroundColor,
    dataBackgroundColor,
    accentColor: tokens.primary,
    borderColor: withAlpha(tokens.border, 0.82),
    borderRadius: 0,
    oddRowBackgroundColor: options.transparentSurface ? "transparent" : withAlpha(tokens.muted, 0.2),
    fontSize: 12,
    headerFontSize: 12,
    spacing: metrics.agGridSpacing,
    wrapperBorderRadius: 0,
  });
}
