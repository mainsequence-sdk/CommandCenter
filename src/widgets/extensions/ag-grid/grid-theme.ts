import { themeQuartz, type Theme } from "ag-grid-community";

import { withAlpha } from "@/lib/color";
import type { ThemeTightnessMetrics } from "@/themes/tightness";
import type { ThemeTokens } from "@/themes/types";

export function createAgGridTerminalTheme(
  tokens: ThemeTokens,
  metrics: ThemeTightnessMetrics["table"],
): Theme {
  return themeQuartz.withParams({
    backgroundColor: withAlpha(tokens.card, 0.98),
    foregroundColor: tokens.foreground,
    textColor: tokens.foreground,
    cellTextColor: tokens.foreground,
    headerTextColor: tokens.foreground,
    headerBackgroundColor: withAlpha(tokens.muted, 0.82),
    chromeBackgroundColor: withAlpha(tokens.card, 0.94),
    dataBackgroundColor: withAlpha(tokens.card, 0.98),
    accentColor: tokens.primary,
    borderColor: withAlpha(tokens.border, 0.82),
    oddRowBackgroundColor: withAlpha(tokens.muted, 0.2),
    fontSize: 12,
    headerFontSize: 12,
    spacing: metrics.agGridSpacing,
  });
}
