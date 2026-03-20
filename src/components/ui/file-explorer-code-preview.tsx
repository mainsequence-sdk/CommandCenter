import { useEffect, useMemo, useState } from "react";

import { type Extension } from "@codemirror/state";
import {
  LanguageDescription,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";

import type { FileExplorerFileItem } from "@/components/ui/file-explorer";
import { useOptionalTheme } from "@/themes/ThemeProvider";
import { type ThemeTokens, themeTokenKeys } from "@/themes/types";

function findLanguageDescription(item: FileExplorerFileItem) {
  return (
    (item.language
      ? LanguageDescription.matchLanguageName(languages, item.language, true)
      : null) ??
    LanguageDescription.matchFilename(languages, item.path ?? item.name)
  );
}

function readFallbackThemeState() {
  const fallbackTokens = {
    background: "#0b1017",
    foreground: "#e6edf7",
    card: "#121925",
    "card-foreground": "#e6edf7",
    popover: "#141b29",
    "popover-foreground": "#e6edf7",
    sidebar: "#0e1522",
    "sidebar-foreground": "#cbd5e1",
    topbar: "#0f1724",
    "topbar-foreground": "#f8fafc",
    muted: "#1a2333",
    "muted-foreground": "#91a4bd",
    border: "#263449",
    input: "#1b2434",
    primary: "#4f8cff",
    "primary-foreground": "#f8fafc",
    secondary: "#1e293b",
    "secondary-foreground": "#e2e8f0",
    accent: "#10b981",
    "accent-foreground": "#032216",
    danger: "#ef4444",
    "danger-foreground": "#ffffff",
    success: "#22c55e",
    "success-foreground": "#02140a",
    warning: "#f59e0b",
    "warning-foreground": "#201400",
    positive: "#22c55e",
    negative: "#f87171",
    ring: "#4f8cff",
    "chart-grid": "#ffffff",
    radius: "16px",
  } satisfies ThemeTokens;

  if (typeof window === "undefined") {
    return {
      mode: "dark" as const,
      tokens: fallbackTokens,
    };
  }

  const root = document.documentElement;
  const styles = window.getComputedStyle(root);
  const tokens = Object.fromEntries(
    themeTokenKeys.map((key) => [
      key,
      styles.getPropertyValue(`--${key}`).trim() || fallbackTokens[key],
    ]),
  ) as ThemeTokens;

  return {
    mode: root.classList.contains("dark") ? ("dark" as const) : ("light" as const),
    tokens,
  };
}

export function FileCodePreview({
  file,
  content,
  height,
}: {
  file: FileExplorerFileItem;
  content: string;
  height: string;
}) {
  const theme = useOptionalTheme();
  const [fallbackThemeState, setFallbackThemeState] = useState(() => readFallbackThemeState());
  const [languageSupport, setLanguageSupport] = useState<Extension | null>(null);

  const languageDescription = useMemo(() => findLanguageDescription(file), [file]);
  const resolvedTokens = theme?.resolvedTokens ?? fallbackThemeState.tokens;
  const themeMode = theme?.activeTheme.mode ?? fallbackThemeState.mode;

  useEffect(() => {
    if (theme || typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setFallbackThemeState(readFallbackThemeState());
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    return () => {
      observer.disconnect();
    };
  }, [theme]);

  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            height: "100%",
            color: resolvedTokens.foreground,
            backgroundColor: resolvedTokens.background,
            fontSize: "0.84rem",
          },
          ".cm-scroller": {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: "1.6",
          },
          ".cm-content": {
            padding: "16px 0",
          },
          ".cm-line": {
            padding: "0 16px",
          },
          ".cm-gutters": {
            minWidth: "52px",
            borderRight: `1px solid ${resolvedTokens.border}`,
            backgroundColor: resolvedTokens.card,
            color: resolvedTokens["muted-foreground"],
          },
          ".cm-activeLine": {
            backgroundColor: resolvedTokens.muted,
          },
          ".cm-activeLineGutter": {
            backgroundColor: resolvedTokens.card,
          },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
            backgroundColor: `${resolvedTokens.primary}33`,
          },
          ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: resolvedTokens.primary,
          },
          ".cm-panels": {
            backgroundColor: resolvedTokens.popover,
            color: resolvedTokens["popover-foreground"],
          },
        },
        { dark: themeMode === "dark" },
      ),
    [resolvedTokens, themeMode],
  );

  const editorExtensions = useMemo<Extension[]>(
    () => [
      editorTheme,
      EditorView.lineWrapping,
      syntaxHighlighting(
        themeMode === "dark" ? oneDarkHighlightStyle : defaultHighlightStyle,
        { fallback: true },
      ),
      ...(languageSupport ? [languageSupport] : []),
    ],
    [editorTheme, languageSupport, themeMode],
  );

  useEffect(() => {
    let cancelled = false;

    setLanguageSupport(languageDescription?.support ?? null);

    if (!languageDescription) {
      return;
    }

    void languageDescription
      .load()
      .then((support) => {
        if (!cancelled) {
          setLanguageSupport(support);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLanguageSupport(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [languageDescription]);

  return (
    <CodeMirror
      value={content}
      theme="none"
      height={height}
      readOnly
      editable={false}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        autocompletion: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        searchKeymap: false,
        lintKeymap: false,
      }}
      extensions={editorExtensions}
      aria-label={`${file.name} preview`}
    />
  );
}
