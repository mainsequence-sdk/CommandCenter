import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type PageToken = number | "start-ellipsis" | "end-ellipsis" | "open-ended";

function buildKnownTotalPageTokens(pageIndex: number, totalPages: number): PageToken[] {
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const edgeWindowSize = 5;
  const tokens = new Set<number>([0, totalPages - 1]);

  if (pageIndex <= 3) {
    Array.from({ length: edgeWindowSize }, (_, index) => index).forEach((page) => {
      tokens.add(page);
    });
  } else if (pageIndex >= totalPages - 4) {
    Array.from({ length: edgeWindowSize }, (_, index) => totalPages - edgeWindowSize + index)
      .forEach((page) => {
        tokens.add(page);
      });
  } else {
    [pageIndex - 1, pageIndex, pageIndex + 1].forEach((page) => {
      tokens.add(page);
    });
  }

  const visiblePages = [...tokens]
    .filter((page) => page >= 0 && page < totalPages)
    .sort((left, right) => left - right);
  const pageTokens: PageToken[] = [];

  visiblePages.forEach((page, index) => {
    const previousPage = visiblePages[index - 1];

    if (previousPage !== undefined && page - previousPage > 1) {
      pageTokens.push(page - previousPage === 2 ? previousPage + 1 : "end-ellipsis");
    }

    pageTokens.push(page);
  });

  return pageTokens;
}

function buildOpenEndedPageTokens(pageIndex: number): PageToken[] {
  const lastKnownPage = pageIndex + 1;
  const start = Math.max(0, lastKnownPage - 4);
  const pages = Array.from({ length: lastKnownPage - start + 1 }, (_, index) => start + index);
  const tokens: PageToken[] = [];

  if (start > 0) {
    tokens.push(0);

    if (start > 1) {
      tokens.push("start-ellipsis");
    }
  }

  tokens.push(...pages, "open-ended");

  return tokens;
}

export function MainSequenceRegistryPagination({
  count,
  hasNextPage,
  hasPreviousPage,
  itemLabel = "results",
  pageIndex,
  pageSize,
  onPageChange,
}: {
  count: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  itemLabel?: string;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
}) {
  const exactTotalPages = Math.max(1, Math.ceil(count / pageSize));
  const minimumKnownPages = Math.max(
    exactTotalPages,
    hasNextPage ? pageIndex + 2 : pageIndex + 1,
  );
  const hasOpenEndedNext = Boolean(hasNextPage) && exactTotalPages <= pageIndex + 2;
  const totalPages = minimumKnownPages;
  const visiblePageTokens = hasOpenEndedNext
    ? buildOpenEndedPageTokens(pageIndex)
    : buildKnownTotalPageTokens(pageIndex, totalPages);
  const start = count === 0 ? 0 : pageIndex * pageSize + 1;
  const nominalEnd = (pageIndex + 1) * pageSize;
  const end = count === 0 ? 0 : hasOpenEndedNext ? nominalEnd : Math.min(count, nominalEnd);
  const minimumTotalCount = hasOpenEndedNext ? Math.max(count, nominalEnd + 1) : count;
  const canGoPrevious = hasPreviousPage ?? pageIndex > 0;
  const canGoNext = hasNextPage ?? pageIndex < totalPages - 1;
  const goToPage = (targetPageIndex: number) => {
    const maxNavigablePageIndex = hasOpenEndedNext ? pageIndex + 1 : totalPages - 1;
    const normalizedTargetPageIndex = Math.max(0, Math.min(targetPageIndex, maxNavigablePageIndex));

    if (normalizedTargetPageIndex === pageIndex) {
      return;
    }

    onPageChange(normalizedTargetPageIndex);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {count === 0
          ? `No ${itemLabel}`
          : `${start}-${end} of ${hasOpenEndedNext ? `at least ${minimumTotalCount}` : count} ${itemLabel}`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canGoPrevious}
          onClick={() => goToPage(pageIndex - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        {visiblePageTokens.map((token, index) => {
          if (typeof token !== "number") {
            return (
              <span
                key={`${token}-${index}`}
                className="flex h-9 min-w-9 items-center justify-center rounded-[calc(var(--radius)-8px)] px-2 text-sm text-muted-foreground"
                aria-label={token === "open-ended" ? "More pages available" : "Skipped pages"}
              >
                ...
              </span>
            );
          }

          return (
            <Button
              key={token}
              type="button"
              variant={token === pageIndex ? "default" : "outline"}
              size="sm"
              aria-current={token === pageIndex ? "page" : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                goToPage(token);
              }}
            >
              {token + 1}
            </Button>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canGoNext}
          onClick={() => goToPage(pageIndex + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
