import { titleCase } from "@/lib/utils";

export const MAINSEQUENCE_COMMAND_KEYWORD = "mainsequence-command";
export const MAINSEQUENCE_COMMAND_MANIFEST_KEY = "mainsequence-command";

export type ExtensionPackageKind =
  | "extension"
  | "theme"
  | "skill"
  | "plugin"
  | "package";

export interface ExtensionGalleryEntry {
  name: string;
  title: string;
  version: string;
  description: string;
  kind: ExtensionPackageKind;
  keywords: string[];
  categories: string[];
  publishedAt?: string;
  npmUrl: string;
  repoUrl?: string;
  homepageUrl?: string;
  demoUrl?: string;
  authorName?: string;
  authorUrl?: string;
  previewImage?: string;
  previewVideo?: string;
  downloads30d?: number;
}

interface NpmSearchResponse {
  objects?: NpmSearchObject[];
}

interface NpmSearchObject {
  downloads?: {
    monthly?: number;
  };
  package: {
    date?: string;
    description?: string;
    keywords?: string[];
    links?: {
      homepage?: string;
      npm?: string;
      repository?: string;
    };
    name: string;
    publisher?: {
      username?: string;
    };
    version: string;
  };
}

type NpmPackageManifest = Record<string, unknown> & {
  author?: unknown;
  description?: string;
  homepage?: string;
  keywords?: string[];
  name: string;
  repository?: unknown;
  version: string;
};

type ManifestAuthor = {
  name?: string;
  url?: string;
};

type ExtensionManifest = {
  author?: ManifestAuthor;
  categories?: string[];
  demo?: string;
  description?: string;
  image?: string;
  title?: string;
  type?: ExtensionPackageKind;
  video?: string;
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toHttpsUrl(value: string) {
  return value
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
}

function normalizeRepositoryUrl(repository: unknown) {
  if (typeof repository === "string" && repository.trim()) {
    return toHttpsUrl(repository.trim());
  }

  if (
    repository &&
    typeof repository === "object" &&
    "url" in repository &&
    typeof repository.url === "string"
  ) {
    return toHttpsUrl(repository.url);
  }

  return undefined;
}

function normalizeAuthor(author: unknown, fallbackName?: string): ManifestAuthor | undefined {
  if (!author) {
    return fallbackName ? { name: fallbackName } : undefined;
  }

  if (typeof author === "string" && author.trim()) {
    return {
      name: author.replace(/<.*?>/g, "").replace(/\(.*?\)/g, "").trim(),
    };
  }

  if (author && typeof author === "object") {
    const name = "name" in author ? asString(author.name) : undefined;
    const url = "url" in author ? asString(author.url) : undefined;

    if (name || url) {
      return { name, url };
    }
  }

  return fallbackName ? { name: fallbackName } : undefined;
}

function readExtensionManifest(
  manifest: NpmPackageManifest | null,
  manifestKey: string,
): ExtensionManifest | null {
  if (!manifest) {
    return null;
  }

  const candidate =
    manifest[manifestKey] ??
    manifest.mainsequenceCommand ??
    manifest.mainsequence_command;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const type = asString(record.type);

  return {
    type:
      type === "extension" ||
      type === "theme" ||
      type === "skill" ||
      type === "plugin" ||
      type === "package"
        ? type
        : undefined,
    title: asString(record.title),
    description: asString(record.description),
    image: asString(record.image),
    video: asString(record.video),
    demo: asString(record.demo) ?? asString(record.demoUrl),
    categories: asStringArray(record.categories),
    author:
      record.author && typeof record.author === "object"
        ? {
            name: "name" in record.author ? asString(record.author.name) : undefined,
            url: "url" in record.author ? asString(record.author.url) : undefined,
          }
        : undefined,
  };
}

function titleFromPackageName(name: string) {
  const baseName = name.split("/").at(-1) ?? name;
  return titleCase(baseName.replace(/(^mainsequence-|-(extension|theme|skill|plugin)$)/g, ""));
}

async function fetchLatestManifest(name: string) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);

  if (!response.ok) {
    throw new Error(`Failed to load manifest for ${name}`);
  }

  return (await response.json()) as NpmPackageManifest;
}

function normalizeEntry(
  entry: NpmSearchObject,
  manifest: NpmPackageManifest | null,
  manifestKey: string,
): ExtensionGalleryEntry {
  const extensionManifest = readExtensionManifest(manifest, manifestKey);
  const author = normalizeAuthor(manifest?.author, entry.package.publisher?.username);

  return {
    name: entry.package.name,
    title: extensionManifest?.title ?? titleFromPackageName(entry.package.name),
    version: manifest?.version ?? entry.package.version,
    description:
      extensionManifest?.description ??
      manifest?.description ??
      entry.package.description ??
      "No description provided.",
    kind: extensionManifest?.type ?? "extension",
    keywords: manifest?.keywords ?? entry.package.keywords ?? [],
    categories: extensionManifest?.categories ?? [],
    publishedAt: entry.package.date,
    npmUrl:
      entry.package.links?.npm ?? `https://www.npmjs.com/package/${encodeURIComponent(entry.package.name)}`,
    repoUrl: normalizeRepositoryUrl(manifest?.repository) ?? entry.package.links?.repository,
    homepageUrl: asString(manifest?.homepage) ?? entry.package.links?.homepage,
    demoUrl: extensionManifest?.demo,
    authorName: author?.name,
    authorUrl: author?.url,
    previewImage: extensionManifest?.image,
    previewVideo: extensionManifest?.video,
    downloads30d: entry.downloads?.monthly,
  };
}

export async function fetchExtensionGallery(
  keyword = MAINSEQUENCE_COMMAND_KEYWORD,
  manifestKey = MAINSEQUENCE_COMMAND_MANIFEST_KEY,
) {
  const searchResponse = await fetch(
    `https://registry.npmjs.org/-/v1/search?text=keywords:${encodeURIComponent(keyword)}&size=60`,
  );

  if (!searchResponse.ok) {
    throw new Error("Could not load packages from npm.");
  }

  const searchPayload = (await searchResponse.json()) as NpmSearchResponse;
  const results = searchPayload.objects ?? [];

  const manifests = await Promise.allSettled(
    results.map((entry) => fetchLatestManifest(entry.package.name)),
  );

  return results.map((entry, index) =>
    normalizeEntry(
      entry,
      manifests[index]?.status === "fulfilled" ? manifests[index].value : null,
      manifestKey,
    ),
  );
}
