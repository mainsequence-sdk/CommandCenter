import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { appRegistry } from "@/app/registry";
import { themeTokenKeys, type ThemePreset, type ThemeTokenKey, type ThemeTokens } from "@/themes/types";

interface ThemeContextValue {
  availableThemes: ThemePreset[];
  activeTheme: ThemePreset;
  themeId: string;
  resolvedTokens: ThemeTokens;
  overrides: Partial<ThemeTokens>;
  setThemeById: (id: string) => void;
  cycleTheme: () => void;
  updateToken: (key: ThemeTokenKey, value: string) => void;
  resetOverrides: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const DEFAULT_THEME_ID = "quartz-light";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const availableThemes = appRegistry.themes;
  const defaultThemeId =
    availableThemes.find((theme) => theme.id === DEFAULT_THEME_ID)?.id ??
    availableThemes[0]?.id ??
    DEFAULT_THEME_ID;
  const [themeId, setThemeId] = useState(defaultThemeId);
  const [overrides, setOverrides] = useState<Partial<ThemeTokens>>({});

  const activeTheme =
    availableThemes.find((theme) => theme.id === themeId) ??
    availableThemes.find((theme) => theme.id === defaultThemeId) ??
    availableThemes[0];

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
  }, [activeTheme, resolvedTokens]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      availableThemes,
      activeTheme,
      themeId: activeTheme.id,
      resolvedTokens,
      overrides,
      setThemeById(id) {
        setThemeId(id);
        setOverrides({});
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
      },
      updateToken(key, value) {
        setOverrides((current) => ({
          ...current,
          [key]: value,
        }));
      },
      resetOverrides() {
        setOverrides({});
      },
    }),
    [activeTheme, availableThemes, overrides, resolvedTokens],
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
