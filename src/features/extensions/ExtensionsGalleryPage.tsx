import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from "react";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Download,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { LogoMark } from "@/components/brand/LogoMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, titleCase } from "@/lib/utils";

import {
  fetchExtensionGallery,
  MAINSEQUENCE_COMMAND_KEYWORD,
  type ExtensionGalleryEntry,
  type ExtensionPackageKind,
} from "./npm-extension-gallery";

const kindOptions: Array<{ value: "all" | ExtensionPackageKind; label: string }> = [
  { value: "all", label: "All" },
  { value: "extension", label: "Extensions" },
  { value: "theme", label: "Themes" },
  { value: "skill", label: "Skills" },
  { value: "plugin", label: "Plugins" },
];

const sortOptions = [
  { value: "downloads", label: "Most downloaded" },
  { value: "recent", label: "Recently published" },
  { value: "az", label: "A-Z" },
] as const;

type SortMode = (typeof sortOptions)[number]["value"];

const publishSnippet = `{
  "name": "@acme/foo-command",
  "version": "1.0.0",
  "keywords": ["mainsequence-command"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/acme/foo-command.git"
  },
  "homepage": "https://github.com/acme/foo-command",
  "mainsequence-command": {
    "type": "extension",
    "title": "Foo Command",
    "description": "Adds Foo workflow support",
    "image": "https://cdn.example.com/foo.png",
    "video": "https://cdn.example.com/foo.mp4",
    "demo": "https://foo-demo.example.com",
    "categories": ["automation", "research"],
    "author": {
      "name": "Jane Doe",
      "url": "https://github.com/janedoe"
    }
  }
}`;

function formatCompactNumber(value?: number) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPublishedDate(value?: string) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function normalizeKind(value: string | null): "all" | ExtensionPackageKind {
  return kindOptions.some((option) => option.value === value)
    ? (value as "all" | ExtensionPackageKind)
    : "all";
}

function normalizeSort(value: string | null): SortMode {
  return sortOptions.some((option) => option.value === value)
    ? (value as SortMode)
    : "downloads";
}

function metadataText(entry: ExtensionGalleryEntry) {
  return [
    entry.title,
    entry.name,
    entry.description,
    entry.authorName,
    ...entry.categories,
    ...entry.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function ExtensionPreview({
  entry,
  className,
}: {
  entry: ExtensionGalleryEntry;
  className?: string;
}) {
  if (entry.previewVideo) {
    return (
      <video
        className={cn("h-full w-full object-cover", className)}
        autoPlay
        loop
        muted
        playsInline
        poster={entry.previewImage}
        preload="metadata"
      >
        <source src={entry.previewVideo} />
      </video>
    );
  }

  if (entry.previewImage) {
    return (
      <img
        src={entry.previewImage}
        alt={entry.title}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col justify-between bg-[linear-gradient(155deg,rgba(213,188,133,0.17),rgba(255,255,255,0.03)_52%,rgba(11,16,23,0.42))] p-4 text-left",
        className,
      )}
    >
      <Badge variant="primary" className="w-fit">
        {titleCase(entry.kind)}
      </Badge>
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Community package
        </div>
        <div className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          {entry.title}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{entry.name}</div>
      </div>
    </div>
  );
}

function ExtensionDetailDialog({
  entry,
  onClose,
}: {
  entry: ExtensionGalleryEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onClose}
      title={entry?.title ?? "Extension"}
      description={entry?.description}
      className="max-w-[min(1100px,calc(100vw-24px))]"
      contentClassName="space-y-6"
    >
      {entry ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
            <div className="overflow-hidden rounded-[calc(var(--radius)+8px)] border border-border/70 bg-background/45">
              <div className="aspect-[16/9] bg-background/80">
                <ExtensionPreview entry={entry} />
              </div>
            </div>

            <div className="space-y-4 rounded-[calc(var(--radius)+2px)] border border-border/70 bg-background/35 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="primary">{titleCase(entry.kind)}</Badge>
                <Badge variant="neutral">v{entry.version}</Badge>
                <Badge variant="secondary">{MAINSEQUENCE_COMMAND_KEYWORD}</Badge>
              </div>

              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/55 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em]">Package</div>
                  <div className="mt-1 font-mono text-foreground">{entry.name}</div>
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/55 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em]">Downloads (30d)</div>
                  <div className="mt-1 text-foreground">{formatCompactNumber(entry.downloads30d)}</div>
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/55 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em]">Published</div>
                  <div className="mt-1 text-foreground">{formatPublishedDate(entry.publishedAt)}</div>
                </div>
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/55 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em]">Author</div>
                  <div className="mt-1 text-foreground">{entry.authorName ?? "Unknown"}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <a href={entry.npmUrl} target="_blank" rel="noreferrer">
                  <Button size="sm">npm</Button>
                </a>
                {entry.repoUrl ? (
                  <a href={entry.repoUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      Source
                    </Button>
                  </a>
                ) : null}
                {entry.demoUrl ? (
                  <a href={entry.demoUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      Demo
                    </Button>
                  </a>
                ) : null}
                {entry.homepageUrl ? (
                  <a href={entry.homepageUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      Homepage
                    </Button>
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {entry.categories.length ? (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Categories
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.categories.map((category) => (
                  <Badge key={category} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {entry.keywords.length ? (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Keywords
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.keywords.map((keyword) => (
                  <Badge key={keyword} variant="neutral">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Install
            </div>
            <pre className="overflow-x-auto rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/60 p-4 text-sm text-foreground">
npm install {entry.name}
            </pre>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

export function ExtensionsGalleryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEntry, setSelectedEntry] = useState<ExtensionGalleryEntry | null>(null);

  const queryValue = searchParams.get("q") ?? "";
  const selectedKind = normalizeKind(searchParams.get("kind"));
  const sortMode = normalizeSort(searchParams.get("sort"));
  const deferredQuery = useDeferredValue(queryValue);

  const galleryQuery = useQuery({
    queryKey: ["npm-extension-gallery", MAINSEQUENCE_COMMAND_KEYWORD],
    queryFn: () => fetchExtensionGallery(MAINSEQUENCE_COMMAND_KEYWORD),
    staleTime: 10 * 60_000,
  });

  const entries = galleryQuery.data ?? [];
  const visibleEntries = [...entries]
    .filter((entry) => {
      if (selectedKind !== "all" && entry.kind !== selectedKind) {
        return false;
      }

      if (!deferredQuery.trim()) {
        return true;
      }

      return metadataText(entry).includes(deferredQuery.trim().toLowerCase());
    })
    .sort((left, right) => {
      if (sortMode === "az") {
        return left.title.localeCompare(right.title);
      }

      if (sortMode === "recent") {
        return (Date.parse(right.publishedAt ?? "") || 0) - (Date.parse(left.publishedAt ?? "") || 0);
      }

      return (right.downloads30d ?? 0) - (left.downloads30d ?? 0);
    });

  const kindCounts = useMemo(() => {
    return entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.kind] = (acc[entry.kind] ?? 0) + 1;
      return acc;
    }, {});
  }, [entries]);

  function updateParams(nextValues: {
    kind?: string;
    q?: string;
    sort?: string;
  }) {
    startTransition(() => {
      const next = new URLSearchParams(searchParams);

      Object.entries(nextValues).forEach(([key, value]) => {
        if (!value) {
          next.delete(key);
          return;
        }

        next.set(key, value);
      });

      setSearchParams(next, { replace: true });
    });
  }

  return (
    <>
      <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1520px] flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="border-b border-border/70 bg-[linear-gradient(140deg,rgba(213,188,133,0.16),transparent_42%,rgba(255,255,255,0.03)_100%)] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <LogoMark className="h-10 w-10 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-card/70 p-1.5" />
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Public Registry
                      </div>
                      <BrandWordmark imageClassName="h-5" />
                    </div>
                  </div>
                  <div className="max-w-3xl space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      Main Sequence extensions gallery
                    </h1>
                    <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                      Public discovery surface for npm packages tagged with{" "}
                      <span className="font-mono text-foreground">{MAINSEQUENCE_COMMAND_KEYWORD}</span>.
                      The gallery reads standard npm metadata plus optional preview and category fields
                      from the package manifest.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => galleryQuery.refetch()}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button onClick={() => navigate("/app")}>
                    <ArrowUpRight className="h-4 w-4" />
                    Open app
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Indexed packages
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {entries.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Preview-ready packages
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {entries.filter((entry) => entry.previewImage || entry.previewVideo).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Registry keyword
                </div>
                <div className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  {MAINSEQUENCE_COMMAND_KEYWORD}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-5 p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Search
                      </div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={queryValue}
                          onChange={(event) => updateParams({ q: event.target.value || undefined })}
                          className="pl-10"
                          placeholder="Search packages, categories, authors"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Sort
                      </div>
                      <Select
                        value={sortMode}
                        onChange={(event) => updateParams({ sort: event.target.value })}
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {kindOptions.map((option) => {
                      const count = option.value === "all" ? entries.length : kindCounts[option.value] ?? 0;
                      const active = selectedKind === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateParams({ kind: option.value === "all" ? undefined : option.value })}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                            active
                              ? "border-primary/35 bg-primary/12 text-foreground"
                              : "border-border/70 bg-background/45 text-muted-foreground hover:bg-muted/35 hover:text-foreground",
                          )}
                        >
                          <span>{option.label}</span>
                          <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px]">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {galleryQuery.isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="overflow-hidden">
                      <div className="aspect-[16/10] animate-pulse bg-muted/40" />
                      <CardContent className="space-y-3 p-5">
                        <div className="h-5 w-2/3 animate-pulse rounded bg-muted/40" />
                        <div className="h-4 w-full animate-pulse rounded bg-muted/30" />
                        <div className="h-4 w-4/5 animate-pulse rounded bg-muted/30" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : galleryQuery.isError ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Registry unavailable</CardTitle>
                    <CardDescription>
                      The npm registry could not be reached from this browser session.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      This page reads live package metadata from npm. Retry the request or publish the
                      index through a backend cache if you want stronger guarantees.
                    </p>
                    <Button variant="outline" onClick={() => galleryQuery.refetch()}>
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : entries.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No packages published yet</CardTitle>
                    <CardDescription>
                      npm currently returns zero packages tagged with{" "}
                      <span className="font-mono">{MAINSEQUENCE_COMMAND_KEYWORD}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Publish a package with that keyword and the optional manifest block shown on the
                      right to make it appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : visibleEntries.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No packages match the current filters</CardTitle>
                    <CardDescription>
                      Clear the search or kind filter to see the full registry set again.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      onClick={() => updateParams({ kind: undefined, q: undefined })}
                    >
                      Clear filters
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {visibleEntries.map((entry) => (
                    <Card
                      key={entry.name}
                      className="group cursor-pointer overflow-hidden transition-colors hover:border-primary/35"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <div className="relative aspect-[16/10] overflow-hidden border-b border-border/70 bg-background/75">
                        <ExtensionPreview entry={entry} className="transition-transform duration-300 group-hover:scale-[1.02]" />
                      </div>
                      <CardContent className="space-y-4 p-5">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-lg font-semibold tracking-tight text-foreground">
                                {entry.title}
                              </div>
                              <div className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                {entry.name}
                              </div>
                            </div>
                            <Badge variant="primary">{titleCase(entry.kind)}</Badge>
                          </div>
                          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {entry.description}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/55 p-3">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
                              <Download className="h-3.5 w-3.5" />
                              Downloads
                            </div>
                            <div className="mt-1 text-foreground">
                              {formatCompactNumber(entry.downloads30d)}
                            </div>
                          </div>
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/55 p-3">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
                              <CalendarClock className="h-3.5 w-3.5" />
                              Published
                            </div>
                            <div className="mt-1 text-foreground">
                              {formatPublishedDate(entry.publishedAt)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {entry.categories.slice(0, 3).map((category) => (
                            <Badge key={category} variant="secondary">
                              {category}
                            </Badge>
                          ))}
                          {!entry.categories.length ? (
                            <Badge variant="neutral">Community package</Badge>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                          <a href={entry.npmUrl} target="_blank" rel="noreferrer">
                            <Button size="sm">npm</Button>
                          </a>
                          {entry.repoUrl ? (
                            <a href={entry.repoUrl} target="_blank" rel="noreferrer">
                              <Button variant="outline" size="sm">
                                Source
                              </Button>
                            </a>
                          ) : null}
                          {(entry.demoUrl ?? entry.homepageUrl) ? (
                            <a
                              href={entry.demoUrl ?? entry.homepageUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button variant="outline" size="sm">
                                Demo
                              </Button>
                            </a>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <Card className="xl:sticky xl:top-6">
                <CardHeader>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Publish contract
                  </div>
                  <CardTitle>How packages get listed</CardTitle>
                  <CardDescription>
                    This gallery is a read-only view over npm. Community packages appear here when they
                    use the correct keyword and optional manifest metadata.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-4 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        Add <span className="font-mono text-foreground">{MAINSEQUENCE_COMMAND_KEYWORD}</span>{" "}
                        to `keywords`.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        Put preview and categorization metadata under the{" "}
                        <span className="font-mono text-foreground">mainsequence-command</span> key in
                        `package.json`.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>Show source and author clearly. Community packages should be reviewable before install.</div>
                    </div>
                  </div>

                  <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/60 p-4">
                    <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Example manifest
                    </div>
                    <pre className="overflow-x-auto text-xs leading-6 text-foreground">
{publishSnippet}
                    </pre>
                  </div>

                  <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                    Community packages can execute arbitrary code after installation. Review the source
                    repository before adoption.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ExtensionDetailDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </>
  );
}
