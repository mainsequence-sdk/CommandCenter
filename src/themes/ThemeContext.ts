import { createContext, useContext } from "react";

import type {
  ResolvedThemeDataVizPalette,
  ThemePreset,
  ThemeSurfaceHierarchy,
  ThemeTightness,
  ThemeTokenKey,
  ThemeTokens,
} from "@/themes/types";

export interface ThemeContextValue {
  availableThemes: ThemePreset[];
  activeTheme: ThemePreset;
  themeId: string;
  resolvedTokens: ThemeTokens;
  resolvedDataViz: ResolvedThemeDataVizPalette;
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

export const ThemeContext = createContext<ThemeContextValue | null>(null);

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

export function useThemeDataViz() {
  return useTheme().resolvedDataViz;
}
