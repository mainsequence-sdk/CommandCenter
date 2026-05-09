import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

import {
  documentationNavSections,
  documentationPageMap,
  getAdjacentDocumentationPages,
  getDocumentationPageLocation,
  type DocumentationNavItem,
  type DocumentationPageContent,
} from "./content/docsContent";

export const commandCenterDocsAppId = "command-center-docs";

function getDocumentationPath(pageId: string) {
  return getAppPath(commandCenterDocsAppId, pageId);
}

function transformDocumentationHref(href: string) {
  if (href.startsWith("#")) {
    return href;
  }

  const [path = "", hash] = href.split("#");
  const normalizedPageId = path
    .replace(/^\.\//, "")
    .replace(/\.md$/, "");

  if (documentationPageMap.has(normalizedPageId)) {
    return `${getDocumentationPath(normalizedPageId)}${hash ? `#${hash}` : ""}`;
  }

  return href;
}

export function createDocumentationPage(pageId: string) {
  function DocumentationSurface() {
    return <DocumentationPage pageId={pageId} />;
  }

  DocumentationSurface.displayName = `DocumentationSurface:${pageId}`;

  return DocumentationSurface;
}

function DocumentationTreeItems({
  activePageId,
  items,
  level = 0,
}: {
  activePageId: string;
  items: readonly DocumentationNavItem[];
  level?: number;
}) {
  return (
    <div className={cn("space-y-1", level > 0 && "mt-2 ml-3 border-l border-border/60 pl-3")}>
      {items.map((item) => {
        if (item.type === "group") {
          return (
            <div key={item.id} className="py-1">
              <div className="text-[11px] font-semibold text-foreground">{item.title}</div>
              {item.description ? (
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.description}</p>
              ) : null}
              <DocumentationTreeItems
                activePageId={activePageId}
                items={item.items}
                level={level + 1}
              />
            </div>
          );
        }

        const page = documentationPageMap.get(item.pageId);

        if (!page) {
          return null;
        }

        const active = page.id === activePageId;

        return (
          <Link
            key={page.id}
            to={getDocumentationPath(page.id)}
            className={cn(
              "block border-l-2 py-1.5 pl-3 pr-2 transition-colors",
              active
                ? "border-primary bg-primary/6 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground",
            )}
          >
            <span className="block text-sm font-medium">{page.navLabel}</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {page.description}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function DocumentationTreeNav({ activePageId }: { activePageId: string }) {
  return (
    <aside className="lg:sticky lg:top-5 lg:self-start">
      <div className="border-b border-border/60 pb-5 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Documentation
        </div>

        <nav className="mt-5 space-y-6">
          {documentationNavSections.map((section) => (
            <section key={section.id}>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {section.title}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{section.description}</p>
              <DocumentationTreeItems activePageId={activePageId} items={section.items} />
            </section>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function AdjacentPageLink({
  direction,
  page,
}: {
  direction: "previous" | "next";
  page: DocumentationPageContent;
}) {
  return (
    <Link
      to={getDocumentationPath(page.id)}
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        direction === "next" && "ml-auto",
      )}
    >
      {direction === "previous" ? (
        <ArrowRight className="h-4 w-4 rotate-180" />
      ) : null}
      <span>
        {direction === "previous" ? "Previous:" : "Next:"} {page.title}
      </span>
      {direction === "next" ? <ArrowRight className="h-4 w-4" /> : null}
    </Link>
  );
}

export function DocumentationPage({ pageId }: { pageId: string }) {
  const page = documentationPageMap.get(pageId);
  const fallbackPage = documentationPageMap.get("getting-started");
  const resolvedPage = page ?? fallbackPage;
  const location = resolvedPage ? getDocumentationPageLocation(resolvedPage.id) : null;
  const { previousPage, nextPage } = resolvedPage
    ? getAdjacentDocumentationPages(resolvedPage.id)
    : { previousPage: undefined, nextPage: undefined };

  if (!resolvedPage) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-6 lg:px-8">
      <PageHeader
        eyebrow={location?.group?.title ?? location?.section.title ?? "Documentation"}
        title={resolvedPage.title}
        description={resolvedPage.description}
      />

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <DocumentationTreeNav activePageId={resolvedPage.id} />

        <main className="min-w-0">
          <article className="rounded-[var(--radius)] border border-border/75 bg-card/85 px-5 py-5 shadow-[var(--shadow-panel)] md:px-7 md:py-7">
            <MarkdownContent
              content={resolvedPage.content}
              transformHref={transformDocumentationHref}
              openLinksInNewTab={false}
            />
          </article>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border/60 pt-4">
            {previousPage ? (
              <AdjacentPageLink direction="previous" page={previousPage} />
            ) : (
              <span />
            )}
            {nextPage ? <AdjacentPageLink direction="next" page={nextPage} /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
