import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

function getVisiblePages(pageIndex: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const start = Math.max(0, Math.min(pageIndex - 2, totalPages - 5));
  return Array.from({ length: 5 }, (_, index) => start + index);
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
  const totalPages = Math.max(
    exactTotalPages,
    hasNextPage ? pageIndex + 2 : pageIndex + 1,
  );
  const visiblePages = getVisiblePages(pageIndex, totalPages);
  const start = count === 0 ? 0 : pageIndex * pageSize + 1;
  const end = count === 0 ? 0 : Math.min(count, (pageIndex + 1) * pageSize);
  const canGoPrevious = hasPreviousPage ?? pageIndex > 0;
  const canGoNext = hasNextPage ?? pageIndex < totalPages - 1;
  const goToPage = (targetPageIndex: number) => {
    const normalizedTargetPageIndex = Math.max(0, Math.min(targetPageIndex, totalPages - 1));

    if (normalizedTargetPageIndex === pageIndex) {
      return;
    }

    onPageChange(normalizedTargetPageIndex);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {count === 0 ? `No ${itemLabel}` : `${start}-${end} of ${count} ${itemLabel}`}
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
        {visiblePages.map((visiblePageIndex) => (
          <Button
            key={visiblePageIndex}
            type="button"
            variant={visiblePageIndex === pageIndex ? "default" : "outline"}
            size="sm"
            aria-current={visiblePageIndex === pageIndex ? "page" : undefined}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goToPage(visiblePageIndex);
            }}
          >
            {visiblePageIndex + 1}
          </Button>
        ))}
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
