import { ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

import {
  documentationNavSections,
  documentationPageAliases,
  documentationPageMap,
  getAdjacentDocumentationPages,
  getDocumentationNavSection,
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
    .replace(/\.md$/, "")
    .split("/")
    .filter(Boolean)
    .at(-1) ?? "";
  const resolvedPageId =
    documentationPageMap.has(normalizedPageId)
      ? normalizedPageId
      : documentationPageAliases.get(normalizedPageId);

  if (resolvedPageId && documentationPageMap.has(resolvedPageId)) {
    return `${getDocumentationPath(resolvedPageId)}${hash ? `#${hash}` : ""}`;
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

function DocumentationSectionsSidebar({ activeSectionId }: { activeSectionId: string }) {
  return (
    <aside className="xl:sticky xl:top-5 xl:self-start">
      <div className="px-2">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Documentation
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Application-first guides for signed-in Command Center users.
        </p>
      </div>

      <nav className="mt-4 space-y-1">
        {documentationNavSections.map((section) => {
          const active = section.id === activeSectionId;

          return (
            <Link
              key={section.id}
              to={getDocumentationPath(section.landingPageId)}
              className={cn(
                "block border-l pl-4 py-2.5 transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-border/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              <div className="flex items-start gap-2">
                <ChevronRight
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform",
                    active && "rotate-90 text-primary",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {section.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {section.description}
                  </span>
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function DocumentationSubmenuItems({
  activePageId,
  items,
  level = 0,
}: {
  activePageId: string;
  items: readonly DocumentationNavItem[];
  level?: number;
}) {
  return (
    <div className={cn("space-y-1", level > 0 && "mt-2 pl-3")}>
      {items.map((item) => {
        if (item.type === "group") {
          return (
            <section key={item.id} className="border-l border-border/45 pl-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {item.title}
              </div>
              {item.description ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              ) : null}
              <DocumentationSubmenuItems
                activePageId={activePageId}
                items={item.items}
                level={level + 1}
              />
            </section>
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
              "block border-l pl-3 py-2.5 transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-border/45 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            <span className="block text-sm font-medium text-foreground">{page.navLabel}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {page.description}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function DocumentationSubmenuSidebar({
  activePageId,
  sectionId,
}: {
  activePageId: string;
  sectionId: string;
}) {
  const section = getDocumentationNavSection(sectionId);

  if (!section) {
    return null;
  }

  return (
    <aside className="xl:sticky xl:top-5 xl:self-start">
      <div className="px-2">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {section.title}
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
      </div>
      <nav className="mt-4">
        <DocumentationSubmenuItems activePageId={activePageId} items={section.items} />
      </nav>
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
  const activeSectionId = location?.section.id ?? "getting-started";
  const activeSection = location?.section ?? getDocumentationNavSection(activeSectionId);
  const showSectionDirectorySidebar = !activeSection || activeSection.items.length <= 1;
  const showSectionSubmenuSidebar = Boolean(activeSection && activeSection.items.length > 1);
  const { previousPage, nextPage } = resolvedPage
    ? getAdjacentDocumentationPages(resolvedPage.id)
    : { previousPage: undefined, nextPage: undefined };

  if (!resolvedPage) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-6 px-4 py-5 md:px-6 xl:px-8">
      <PageHeader
        eyebrow={location?.group?.title ?? location?.section.title ?? "Documentation"}
        title={resolvedPage.title}
        description={resolvedPage.description}
      />

      <div
        className={cn(
          "grid gap-6",
          (showSectionDirectorySidebar || showSectionSubmenuSidebar) &&
            "xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]",
        )}
      >
        {showSectionDirectorySidebar ? (
          <DocumentationSectionsSidebar activeSectionId={activeSectionId} />
        ) : null}
        {showSectionSubmenuSidebar ? (
          <DocumentationSubmenuSidebar activePageId={resolvedPage.id} sectionId={activeSectionId} />
        ) : null}

        <main className="min-w-0">
          <article className="px-1 md:px-2">
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
