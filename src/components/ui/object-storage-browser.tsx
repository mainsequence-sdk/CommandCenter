import type { ReactNode } from "react";

import {
  ArrowUpDown,
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  Search,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";

export interface ObjectStorageBreadcrumb {
  name: string;
  prefix: string;
}

export interface ObjectStorageFolderRow {
  rowId: string;
  name: string;
  prefix: string;
  countFiles: number;
  countSubfolders: number;
}

export interface ObjectStorageFileRow {
  id: number | string;
  name: string;
  displayName: string;
  createdByPod?: string;
  createdByResourceName?: string;
  creationDateDisplay?: string;
  sizeDisplay: string;
  contentUrl?: string;
}

export interface ObjectStoragePagination {
  page: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrevious: boolean;
  startIndex: number;
  endIndex: number;
}

type ObjectStorageExplorerRow =
  | {
      id: string;
      kind: "folder";
      name: string;
      secondary: string;
      typeLabel: "Folder";
      originLabel: string;
      createdLabel: string;
      detailLabel: string;
      actionLabel: "Open";
      onAction: () => void;
    }
  | {
      id: string;
      kind: "file";
      name: string;
      secondary: string;
      typeLabel: "File";
      originLabel: string;
      createdLabel: string;
      detailLabel: string;
      actionLabel: "Open";
      href?: string;
    };

export function ObjectStorageBrowser({
  actions,
  breadcrumbs,
  currentPrefix,
  dir,
  fileCount,
  files,
  folderCount,
  folders,
  onDirChange,
  onOpenPrefix,
  onPageChange,
  onSearchChange,
  onSortChange,
  pagination,
  searchValue,
  sort,
}: {
  actions?: ReactNode;
  breadcrumbs: ObjectStorageBreadcrumb[];
  currentPrefix: string;
  dir: "asc" | "desc";
  fileCount: number;
  files: ObjectStorageFileRow[];
  folderCount: number;
  folders: ObjectStorageFolderRow[];
  onDirChange: (dir: "asc" | "desc") => void;
  onOpenPrefix: (prefix: string) => void;
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: string) => void;
  pagination: ObjectStoragePagination;
  searchValue: string;
  sort: string;
}) {
  const orderedFolders = [...folders].sort((left, right) => left.name.localeCompare(right.name));
  const rows: ObjectStorageExplorerRow[] = [
    ...orderedFolders.map((folder) => ({
      id: folder.rowId,
      kind: "folder" as const,
      name: folder.name,
      secondary: folder.prefix,
      typeLabel: "Folder" as const,
      originLabel: "-",
      createdLabel: "-",
      detailLabel: `${folder.countFiles} files · ${folder.countSubfolders} subfolders`,
      actionLabel: "Open" as const,
      onAction: () => onOpenPrefix(folder.prefix),
    })),
    ...files.map((file) => ({
      id: String(file.id),
      kind: "file" as const,
      name: file.displayName,
      secondary: file.name,
      typeLabel: "File" as const,
      originLabel: [file.createdByPod, file.createdByResourceName].filter(Boolean).join(" · ") || "-",
      createdLabel: file.creationDateDisplay || "-",
      detailLabel: file.sizeDisplay,
      actionLabel: "Open" as const,
      href: file.contentUrl,
    })),
  ];
  const hasEntries = rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={() => onOpenPrefix("")}
            >
              Root
            </button>
            {breadcrumbs.map((breadcrumb) => (
              <div key={breadcrumb.prefix} className="inline-flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5" />
                <button
                  type="button"
                  className="transition-colors hover:text-foreground"
                  onClick={() => onOpenPrefix(breadcrumb.prefix)}
                >
                  {breadcrumb.name}
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`${folderCount} folders`}</Badge>
            <Badge variant="neutral">{`${fileCount} files`}</Badge>
            <Badge variant="neutral">{currentPrefix || "Root"}</Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[540px] lg:items-end">
          {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search current folder"
                className="pl-9"
              />
            </div>
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value)}
              className="flex h-10 min-w-[170px] rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30"
              aria-label="Sort files"
            >
              <option value="name">Sort: Name</option>
              <option value="created_by_pod">Sort: Created by pod</option>
              <option value="creation_date">Sort: Creation date</option>
              <option value="resource">Sort: Resource</option>
              <option value="size">Sort: Size</option>
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => onDirChange(dir === "asc" ? "desc" : "asc")}
            >
              <ArrowUpDown className="h-4 w-4" />
              {dir === "asc" ? "Ascending" : "Descending"}
            </Button>
          </div>
        </div>
      </div>

      <Card variant="nested">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Explorer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {!hasEntries ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/18 px-4 py-10 text-center text-sm text-muted-foreground">
              This folder is empty.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-border/70">
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Origin</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {row.kind === "folder" ? (
                              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                            ) : (
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                            )}
                            {row.kind === "folder" ? (
                              <button
                                type="button"
                                className="truncate text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:text-primary focus-visible:decoration-primary"
                                onClick={row.onAction}
                                title={row.name}
                              >
                                {row.name}
                              </button>
                            ) : (
                              <div className="truncate font-medium text-foreground" title={row.name}>
                                {row.name}
                              </div>
                            )}
                          </div>
                          <div
                            className={cn("mt-0.5 text-muted-foreground", "truncate")}
                            style={{ fontSize: "var(--table-meta-font-size)" }}
                            title={row.secondary}
                          >
                            {row.secondary}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.typeLabel}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.originLabel}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.createdLabel}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.detailLabel}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.kind === "folder" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={row.onAction}
                          >
                            {row.actionLabel}
                          </Button>
                        ) : row.href ? (
                          <a
                            href={row.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-[calc(var(--radius)-6px)] px-2 py-1 text-primary transition-colors hover:bg-primary/8 hover:text-primary/80"
                          >
                            <Download className="h-4 w-4" />
                            Open
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {pagination.totalItems > 0
                ? `${orderedFolders.length} folders · showing ${pagination.startIndex}-${pagination.endIndex} of ${pagination.totalItems} files`
                : orderedFolders.length > 0
                  ? `${orderedFolders.length} folders in this level`
                  : "No files to paginate"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrevious}
                onClick={() => onPageChange(pagination.page - 1)}
              >
                Previous
              </Button>
              <div className="rounded-full border border-border/70 bg-background/28 px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Page {pagination.page} / {pagination.totalPages}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => onPageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
