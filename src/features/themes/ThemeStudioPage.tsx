import { useMemo, useState } from "react";

import { Check, Copy, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { buildThemeSnippet } from "@/themes/build-theme-snippet";
import { useTheme } from "@/themes/ThemeProvider";
import { themeTokenMetadata } from "@/themes/types";

export function ThemeStudioPage() {
  const {
    activeTheme,
    availableThemes,
    setThemeById,
    resolvedTokens,
    updateToken,
    resetOverrides,
  } = useTheme();
  const [copied, setCopied] = useState(false);

  const generatedPreset = useMemo(
    () =>
      buildThemeSnippet({
        ...activeTheme,
        tokens: resolvedTokens,
      }),
    [activeTheme, resolvedTokens],
  );

  async function copyPreset() {
    try {
      await navigator.clipboard.writeText(generatedPreset);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Design System"
        title="Theme Studio"
        description="Presets are real TypeScript theme objects. The live editor modifies design tokens in-memory and can export a new preset for your codebase."
        actions={
          <>
            <Button variant="outline" onClick={resetOverrides}>
              <RotateCcw className="h-4 w-4" />
              Reset overrides
            </Button>
            <Button onClick={copyPreset}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy preset"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Available presets</CardTitle>
            <CardDescription>Core themes and extension themes are all loaded through the same registry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setThemeById(theme.id)}
                className={`w-full rounded-[calc(var(--radius)-6px)] border px-4 py-3 text-left transition-colors ${
                  activeTheme.id === theme.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/70 bg-background/40 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{theme.label}</div>
                    <div className="text-sm text-muted-foreground">{theme.description}</div>
                  </div>
                  <Badge variant="neutral">{theme.source}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  {["background", "primary", "accent"].map((token) => (
                    <span
                      key={token}
                      className="h-6 w-6 rounded-full border border-border/70"
                      style={{
                        backgroundColor:
                          theme.tokens[token as keyof typeof theme.tokens],
                      }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Token editor</CardTitle>
              <CardDescription>
                Change colors, radius and semantic tokens. Nothing is persisted in this build yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {themeTokenMetadata.map((token) => (
                <label key={token.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{token.label}</span>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {token.group}
                    </span>
                  </div>
                  {token.kind === "color" ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={resolvedTokens[token.key]}
                        onChange={(event) => updateToken(token.key, event.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                      />
                      <Input
                        value={resolvedTokens[token.key]}
                        onChange={(event) => updateToken(token.key, event.target.value)}
                      />
                    </div>
                  ) : (
                    <Input
                      value={resolvedTokens[token.key]}
                      onChange={(event) => updateToken(token.key, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Live preview against the current app shell tokens.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-4">
                  <div className="mb-3 text-sm font-medium">Surface preview</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card p-4">
                      <div className="text-sm font-semibold">Card</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Users can swap theme tokens without touching widget code.
                      </div>
                    </div>
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-sidebar p-4">
                      <div className="text-sm font-semibold text-sidebar-foreground">Sidebar token</div>
                      <div className="mt-1 text-sm text-sidebar-foreground/80">
                        Nav chrome inherits the same semantic token model.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="danger">Danger</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generated preset</CardTitle>
                <CardDescription>Paste this into a new theme file and register it through an extension.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea value={generatedPreset} readOnly className="font-mono text-xs leading-6" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
