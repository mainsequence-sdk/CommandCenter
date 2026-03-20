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
import {
  themeSurfaceHierarchyMetadata,
  themeSurfaceHierarchyOptions,
  themeTokenMetadata,
  themeTightnessMetadata,
  themeTightnessOptions,
} from "@/themes/types";

const themeStudioPreviewRows = [
  {
    id: "alpha",
    name: "Market data sync",
    owner: "Platform",
    status: "Healthy",
    detail: "Updated 12 feeds across 3 regions",
  },
  {
    id: "beta",
    name: "Factor pipeline",
    owner: "Research",
    status: "Running",
    detail: "14 jobs scheduled for the next batch window",
  },
  {
    id: "gamma",
    name: "Audit trail",
    owner: "Operations",
    status: "Review",
    detail: "2 alerts require operator acknowledgement",
  },
] as const;

export function ThemeStudioPage() {
  const {
    activeTheme,
    availableThemes,
    setThemeById,
    resolvedTokens,
    tightness,
    setTightness,
    surfaceHierarchy,
    setSurfaceHierarchy,
    updateToken,
    resetOverrides,
  } = useTheme();
  const [copied, setCopied] = useState(false);

  const generatedPreset = useMemo(
    () =>
      buildThemeSnippet({
        ...activeTheme,
        tightness,
        surfaceHierarchy,
        tokens: resolvedTokens,
      }),
    [activeTheme, resolvedTokens, surfaceHierarchy, tightness],
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant="neutral">{theme.source}</Badge>
                    <Badge variant="secondary">
                      {themeTightnessMetadata[theme.tightness].label}
                    </Badge>
                  </div>
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
                <CardTitle>Surface hierarchy</CardTitle>
                <CardDescription>
                  Controls how strongly nested cards separate from their parent surface.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {themeSurfaceHierarchyOptions.map((option) => {
                  const metadata = themeSurfaceHierarchyMetadata[option];
                  const selected = surfaceHierarchy === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSurfaceHierarchy(option)}
                      className={`rounded-[calc(var(--radius)-6px)] border px-4 py-3 text-left transition-colors ${
                        selected
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/70 bg-background/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="text-sm font-medium text-foreground">{metadata.label}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        {metadata.description}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tightness</CardTitle>
                <CardDescription>
                  Tightness is a theme-level density property. It drives table density, row spacing,
                  and shared typography sizing across core shell surfaces.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {themeTightnessOptions.map((option) => {
                  const metadata = themeTightnessMetadata[option];
                  const selected = tightness === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTightness(option)}
                      className={`rounded-[calc(var(--radius)-6px)] border px-4 py-3 text-left transition-colors ${
                        selected
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/70 bg-background/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="text-sm font-medium text-foreground">{metadata.label}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        {metadata.description}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  Live preview against the current app shell tokens, typography scale, and table
                  density.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-4">
                  <div className="mb-3 text-sm font-medium">Surface preview</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card p-4">
                      <div className="text-sm font-semibold">Card</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Users can swap theme tokens without touching widget code.
                      </div>
                      <Card variant="nested" className="mt-3">
                        <CardContent className="p-4">
                          <div className="text-sm font-semibold text-foreground">Nested card</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            This reflects the current surface hierarchy setting for inner panels.
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-sidebar p-4">
                      <div className="text-sm font-semibold text-sidebar-foreground">Sidebar token</div>
                      <div className="mt-1 text-sm text-sidebar-foreground/80">
                        Nav chrome inherits the same semantic token model.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div
                      className="font-semibold text-foreground"
                      style={{ fontSize: "var(--font-size-section-title)" }}
                    >
                      Typography preview
                    </div>
                    <Badge variant="neutral">{themeTightnessMetadata[tightness].label}</Badge>
                  </div>
                  <div className="space-y-3">
                    <div
                      className="font-semibold tracking-tight text-foreground"
                      style={{ fontSize: "var(--font-size-page-title)" }}
                    >
                      Operations command surface
                    </div>
                    <p
                      className="max-w-2xl text-foreground/90"
                      style={{
                        fontSize: "var(--font-size-body)",
                        lineHeight: "var(--line-height-body)",
                      }}
                    >
                      Tightness is meant to change real working density, not just token labels. This
                      preview shows how titles, supporting copy, and metadata compress as the theme
                      gets denser.
                    </p>
                    <div
                      className="text-muted-foreground"
                      style={{
                        fontSize: "var(--font-size-body-sm)",
                        lineHeight: "var(--line-height-body)",
                      }}
                    >
                      Analysts and operators should be able to feel the difference immediately in the
                      shell, forms, and registry surfaces.
                    </div>
                    <div
                      className="uppercase tracking-[0.18em] text-muted-foreground"
                      style={{ fontSize: "var(--font-size-body-xs)" }}
                    >
                      metadata label
                    </div>
                  </div>
                </div>

                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45">
                  <div className="border-b border-border/70 px-4 py-3">
                    <div
                      className="font-semibold text-foreground"
                      style={{ fontSize: "var(--font-size-section-title)" }}
                    >
                      Table density preview
                    </div>
                    <div
                      className="mt-1 text-muted-foreground"
                      style={{
                        fontSize: "var(--font-size-body-sm)",
                        lineHeight: "var(--line-height-body)",
                      }}
                    >
                      The same row spacing and text variables used in registry tables should tighten
                      here as well.
                    </div>
                  </div>
                  <div className="overflow-x-auto px-4 py-4">
                    <table
                      className="w-full min-w-[620px] border-separate"
                      style={{
                        borderSpacing: "0 var(--table-row-gap-y)",
                        fontSize: "var(--table-font-size)",
                      }}
                    >
                      <thead>
                        <tr
                          className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                          style={{ fontSize: "var(--table-meta-font-size)" }}
                        >
                          <th className="px-4 py-[var(--table-standard-header-padding-y)]">Name</th>
                          <th className="px-4 py-[var(--table-standard-header-padding-y)]">Owner</th>
                          <th className="px-4 py-[var(--table-standard-header-padding-y)]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {themeStudioPreviewRows.map((row) => (
                          <tr key={row.id}>
                            <td className="rounded-l-[calc(var(--radius)-6px)] border border-border/70 border-r-0 bg-background/38 px-4 py-[var(--table-standard-cell-padding-y)]">
                              <div className="font-medium text-foreground">{row.name}</div>
                              <div
                                className="mt-0.5 text-muted-foreground"
                                style={{ fontSize: "var(--table-meta-font-size)" }}
                              >
                                {row.detail}
                              </div>
                            </td>
                            <td className="border border-border/70 border-r-0 bg-background/38 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                              {row.owner}
                            </td>
                            <td className="rounded-r-[calc(var(--radius)-6px)] border border-border/70 bg-background/38 px-4 py-[var(--table-standard-cell-padding-y)] text-foreground">
                              {row.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
