import {
  type KeyboardEvent,
  type ReactNode,
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Folder,
  FolderOpen,
  LoaderCircle,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FileExplorerBaseItem {
  id: string;
  name: string;
  description?: ReactNode;
  path?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
}

export interface FileExplorerFileItem extends FileExplorerBaseItem {
  type: "file";
  children?: never;
  content?: string;
  language?: string | null;
}

export interface FileExplorerFolderItem extends FileExplorerBaseItem {
  type: "folder";
  children?: FileExplorerItem[];
}

export type FileExplorerItem = FileExplorerFileItem | FileExplorerFolderItem;

export interface FileExplorerResolvedContent {
  content: string;
  language?: string | null;
  name?: string;
  path?: string;
}

export type FileExplorerContentResolver = (
  item: FileExplorerFileItem,
) => FileExplorerResolvedContent | string | Promise<FileExplorerResolvedContent | string>;

export interface FileExplorerItemAction {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  isVisible?: (item: FileExplorerItem) => boolean;
  isDisabled?: boolean | ((item: FileExplorerItem) => boolean);
  onClick: (item: FileExplorerItem) => void;
}

export interface FileExplorerProps {
  items: FileExplorerItem[];
  className?: string;
  treeClassName?: string;
  previewClassName?: string;
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  query?: string;
  defaultQuery?: string;
  onSelect?: (item: FileExplorerItem) => void;
  onExpandedIdsChange?: (expandedIds: string[]) => void;
  onQueryChange?: (query: string) => void;
  onRequestFileContent?: FileExplorerContentResolver;
  itemActions?: FileExplorerItemAction[];
  renderItemMeta?: (item: FileExplorerItem) => ReactNode;
  renderItemActions?: (item: FileExplorerItem) => ReactNode;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showPreview?: boolean;
  defaultExpandAll?: boolean;
  autoExpandMatches?: boolean;
  emptyState?: ReactNode;
  noResultsState?: ReactNode;
  previewEmptyState?: ReactNode;
  previewUnavailableState?: ReactNode;
  previewLoadingState?: ReactNode;
  editorHeight?: string;
  ariaLabel?: string;
  previewTrigger?: "select" | "button";
}

interface FilteredNode {
  item: FileExplorerItem;
  parentId?: string;
  children: FilteredNode[];
  forcedExpanded: boolean;
}

interface VisibleNode {
  item: FileExplorerItem;
  parentId?: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

type FileContentState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      value: FileExplorerResolvedContent;
    }
  | {
      status: "error";
      message: string;
    };

function isFolder(item: FileExplorerItem): item is FileExplorerFolderItem {
  return item.type === "folder";
}

function isFile(item: FileExplorerItem | null | undefined): item is FileExplorerFileItem {
  return item?.type === "file";
}

function getSearchableText(item: FileExplorerItem) {
  return `${item.name} ${item.path ?? ""}`.trim().toLowerCase();
}

function normalizeResolvedContent(
  item: FileExplorerFileItem,
  value: FileExplorerResolvedContent | string,
): FileExplorerResolvedContent {
  if (typeof value === "string") {
    return {
      content: value,
      language: item.language,
      name: item.name,
      path: item.path,
    };
  }

  return {
    content: value.content,
    language: value.language ?? item.language,
    name: value.name ?? item.name,
    path: value.path ?? item.path,
  };
}

function collectFolderIds(items: FileExplorerItem[]): string[] {
  return items.flatMap((item) => {
    if (!isFolder(item)) {
      return [];
    }

    return [item.id, ...collectFolderIds(item.children ?? [])];
  });
}

function collectItemMap(items: FileExplorerItem[]) {
  const itemMap = new Map<string, FileExplorerItem>();

  function walk(entries: FileExplorerItem[]) {
    entries.forEach((item) => {
      itemMap.set(item.id, item);

      if (isFolder(item) && item.children?.length) {
        walk(item.children);
      }
    });
  }

  walk(items);

  return itemMap;
}

function filterTree(
  items: FileExplorerItem[],
  query: string,
  parentId?: string,
): FilteredNode[] {
  return items.flatMap((item) => {
    const childNodes = isFolder(item) ? filterTree(item.children ?? [], query, item.id) : [];

    if (!query) {
      return [
        {
          item,
          parentId,
          children: childNodes,
          forcedExpanded: false,
        },
      ];
    }

    const itemMatches = getSearchableText(item).includes(query);
    if (!itemMatches && childNodes.length === 0) {
      return [];
    }

    return [
      {
        item,
        parentId,
        children: childNodes,
        forcedExpanded: childNodes.length > 0,
      },
    ];
  });
}

function flattenTree(
  nodes: FilteredNode[],
  expandedIds: Set<string>,
  query: string,
  autoExpandMatches: boolean,
  depth = 0,
): VisibleNode[] {
  return nodes.flatMap((node) => {
    const hasChildren = isFolder(node.item) && (node.item.children?.length ?? 0) > 0;
    const isExpanded =
      hasChildren &&
      (expandedIds.has(node.item.id) || (!!query && autoExpandMatches && node.forcedExpanded));

    return [
      {
        item: node.item,
        parentId: node.parentId,
        depth,
        hasChildren,
        isExpanded,
      },
      ...(isExpanded
        ? flattenTree(node.children, expandedIds, query, autoExpandMatches, depth + 1)
        : []),
    ];
  });
}

function findNextEnabledIndex(nodes: VisibleNode[], startIndex: number, direction: 1 | -1) {
  let currentIndex = startIndex + direction;

  while (currentIndex >= 0 && currentIndex < nodes.length) {
    if (!nodes[currentIndex]?.item.disabled) {
      return currentIndex;
    }

    currentIndex += direction;
  }

  return -1;
}

function getLanguageLabel(item: FileExplorerFileItem) {
  if (item.language) {
    return item.language;
  }

  const filename = item.path ?? item.name;
  const extension = filename.split(".").at(-1);

  return extension && extension !== filename ? extension.toUpperCase() : "Plain text";
}

function getPreviewErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not load this file.";
}

function isMarkdownFile(item: FileExplorerFileItem) {
  const candidate = `${item.language ?? ""} ${item.path ?? item.name}`.toLowerCase();

  return (
    candidate.includes("markdown") ||
    candidate.endsWith(".md") ||
    candidate.endsWith(".markdown") ||
    candidate.endsWith(".mdx")
  );
}

function isPlainTextFile(item: FileExplorerFileItem) {
  const language = (item.language ?? "").toLowerCase();

  return language === "plaintext" || language === "text" || language === "txt";
}

function resolveItemActions(
  item: FileExplorerItem,
  itemActions?: FileExplorerItemAction[],
) {
  return (itemActions ?? []).filter((action) => action.isVisible?.(item) ?? true);
}

function canRequestPreview(
  item: FileExplorerFileItem,
  onRequestFileContent?: FileExplorerContentResolver,
) {
  return item.content !== undefined || Boolean(onRequestFileContent);
}

const FileCodePreview = lazy(async () => {
  const module = await import("@/components/ui/file-explorer-code-preview");

  return { default: module.FileCodePreview };
});

const MarkdownContent = lazy(async () => {
  const module = await import("@/components/ui/markdown-content");

  return { default: module.MarkdownContent };
});

export function FileExplorer({
  items,
  className,
  treeClassName,
  previewClassName,
  selectedId: selectedIdProp,
  defaultSelectedId = null,
  expandedIds: expandedIdsProp,
  defaultExpandedIds,
  query: queryProp,
  defaultQuery = "",
  onSelect,
  onExpandedIdsChange,
  onQueryChange,
  onRequestFileContent,
  itemActions,
  renderItemMeta,
  renderItemActions,
  searchPlaceholder = "Search files",
  showSearch = true,
  showPreview = true,
  defaultExpandAll = false,
  autoExpandMatches = true,
  emptyState,
  noResultsState,
  previewEmptyState,
  previewUnavailableState,
  previewLoadingState,
  editorHeight = "520px",
  ariaLabel = "File explorer",
  previewTrigger = "button",
}: FileExplorerProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(defaultSelectedId);
  const [internalExpandedIds, setInternalExpandedIds] = useState<string[]>(
    () => defaultExpandedIds ?? (defaultExpandAll ? collectFolderIds(items) : []),
  );
  const [internalQuery, setInternalQuery] = useState(defaultQuery);
  const [activePreviewFileId, setActivePreviewFileId] = useState<string | null>(null);
  const [contentStateById, setContentStateById] = useState<
    Record<string, FileContentState | undefined>
  >({});

  const selectedId = selectedIdProp === undefined ? internalSelectedId : selectedIdProp;
  const expandedIds = expandedIdsProp === undefined ? internalExpandedIds : expandedIdsProp;
  const queryValue = queryProp === undefined ? internalQuery : queryProp;
  const deferredQuery = useDeferredValue(queryValue.trim().toLowerCase());
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previewPanelRef = useRef<HTMLDivElement | null>(null);

  const itemById = useMemo(() => collectItemMap(items), [items]);
  const expandedIdSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const filteredNodes = useMemo(
    () => filterTree(items, deferredQuery),
    [items, deferredQuery],
  );
  const visibleNodes = useMemo(
    () => flattenTree(filteredNodes, expandedIdSet, deferredQuery, autoExpandMatches),
    [filteredNodes, expandedIdSet, deferredQuery, autoExpandMatches],
  );
  const nodeIndexById = useMemo(
    () => new Map(visibleNodes.map((node, index) => [node.item.id, index])),
    [visibleNodes],
  );
  const selectedItem = selectedId ? itemById.get(selectedId) ?? null : null;
  const selectedFile = isFile(selectedItem) ? selectedItem : null;
  const selectedConfiguredItemActions = selectedItem
    ? resolveItemActions(selectedItem, itemActions)
    : [];
  const selectedCustomItemActions = selectedItem ? renderItemActions?.(selectedItem) : null;
  const isPreviewVisible = selectedFile !== null && activePreviewFileId === selectedFile.id;
  const selectedFileContentState = selectedFile ? contentStateById[selectedFile.id] : undefined;
  const selectedResolvedContent =
    selectedFileContentState?.status === "ready" ? selectedFileContentState.value : null;
  const previewFile = selectedFile
    ? {
        ...selectedFile,
        language: selectedResolvedContent?.language ?? selectedFile.language,
        name: selectedResolvedContent?.name ?? selectedFile.name,
        path: selectedResolvedContent?.path ?? selectedFile.path,
      }
    : null;
  const isEmpty = items.length === 0;
  const expansionLocked = autoExpandMatches && deferredQuery.length > 0;

  const previewValue = selectedFile?.content ?? selectedResolvedContent?.content ?? "";

  useEffect(() => {
    if (!selectedFile) {
      setActivePreviewFileId(null);
      return;
    }

    if (previewTrigger === "select") {
      setActivePreviewFileId(selectedFile.id);
      return;
    }

    setActivePreviewFileId((current) => (current === selectedFile.id ? current : null));
  }, [previewTrigger, selectedFile?.id]);

  useEffect(() => {
    if (
      previewTrigger !== "select" ||
      !selectedFile ||
      !isPreviewVisible ||
      selectedFile.content !== undefined ||
      !onRequestFileContent ||
      selectedFileContentState !== undefined
    ) {
      return;
    }

    let cancelled = false;

    setContentStateById((current) => ({
      ...current,
      [selectedFile.id]: {
        status: "loading",
      },
    }));

    void Promise.resolve(onRequestFileContent(selectedFile))
      .then((value) => {
        if (cancelled) {
          return;
        }

        setContentStateById((current) => ({
          ...current,
          [selectedFile.id]: {
            status: "ready",
            value: normalizeResolvedContent(selectedFile, value),
          },
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setContentStateById((current) => ({
          ...current,
          [selectedFile.id]: {
            status: "error",
            message: getPreviewErrorMessage(error),
          },
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    isPreviewVisible,
    onRequestFileContent,
    previewTrigger,
    selectedFile,
    selectedFileContentState,
  ]);

  useEffect(() => {
    if (!showPreview || !selectedFile || typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(min-width: 1024px)").matches) {
      return;
    }

    previewPanelRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [selectedFile?.id, showPreview]);

  function updateSelectedId(nextSelectedId: string | null) {
    if (selectedIdProp === undefined) {
      setInternalSelectedId(nextSelectedId);
    }
  }

  function updateExpandedIds(nextExpandedIds: string[]) {
    if (expandedIdsProp === undefined) {
      setInternalExpandedIds(nextExpandedIds);
    }

    onExpandedIdsChange?.(nextExpandedIds);
  }

  function updateQuery(nextQuery: string) {
    if (queryProp === undefined) {
      setInternalQuery(nextQuery);
    }

    onQueryChange?.(nextQuery);
  }

  function focusItem(itemId: string) {
    itemRefs.current[itemId]?.focus();
  }

  function selectItem(item: FileExplorerItem) {
    if (item.disabled) {
      return;
    }

    updateSelectedId(item.id);
    onSelect?.(item);
  }

  function toggleFolder(folderId: string) {
    const nextExpandedIds = expandedIdSet.has(folderId)
      ? expandedIds.filter((id) => id !== folderId)
      : [...expandedIds, folderId];

    updateExpandedIds(nextExpandedIds);
  }

  function retryPreviewLoad(fileId: string) {
    setContentStateById((current) => {
      const { [fileId]: _discarded, ...rest } = current;
      return rest;
    });
  }

  function loadPreviewForFile(file: FileExplorerFileItem) {
    if (file.content !== undefined || !onRequestFileContent) {
      return;
    }

    setContentStateById((current) => {
      if (current[file.id]?.status === "loading") {
        return current;
      }

      return {
        ...current,
        [file.id]: {
          status: "loading",
        },
      };
    });

    void Promise.resolve(onRequestFileContent(file))
      .then((value) => {
        setContentStateById((current) => ({
          ...current,
          [file.id]: {
            status: "ready",
            value: normalizeResolvedContent(file, value),
          },
        }));
      })
      .catch((error) => {
        setContentStateById((current) => ({
          ...current,
          [file.id]: {
            status: "error",
            message: getPreviewErrorMessage(error),
          },
        }));
      });
  }

  function togglePreviewForSelectedFile() {
    if (!selectedFile || !canRequestPreview(selectedFile, onRequestFileContent)) {
      return;
    }

    setActivePreviewFileId((current) => {
      if (current === selectedFile.id) {
        return null;
      }

      return selectedFile.id;
    });

    if (
      previewTrigger === "button" &&
      selectedFile.content === undefined &&
      onRequestFileContent &&
      selectedFileContentState === undefined
    ) {
      loadPreviewForFile(selectedFile);
    }
  }

  function handleRetryPreviewLoad(file: FileExplorerFileItem) {
    retryPreviewLoad(file.id);

    if (previewTrigger === "button") {
      loadPreviewForFile(file);
    }
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLButtonElement>, node: VisibleNode) {
    const currentIndex = nodeIndexById.get(node.item.id);
    if (currentIndex === undefined) {
      return;
    }

    if (event.key === "ArrowDown") {
      const nextIndex = findNextEnabledIndex(visibleNodes, currentIndex, 1);
      if (nextIndex >= 0) {
        event.preventDefault();
        selectItem(visibleNodes[nextIndex].item);
        focusItem(visibleNodes[nextIndex].item.id);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      const nextIndex = findNextEnabledIndex(visibleNodes, currentIndex, -1);
      if (nextIndex >= 0) {
        event.preventDefault();
        selectItem(visibleNodes[nextIndex].item);
        focusItem(visibleNodes[nextIndex].item.id);
      }
      return;
    }

    if (event.key === "ArrowRight" && isFolder(node.item) && node.hasChildren) {
      event.preventDefault();

      if (!node.isExpanded && !expansionLocked) {
        toggleFolder(node.item.id);
        return;
      }

      const nextNode = visibleNodes[currentIndex + 1];
      if (nextNode && nextNode.depth === node.depth + 1) {
        selectItem(nextNode.item);
        focusItem(nextNode.item.id);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();

      if (isFolder(node.item) && node.isExpanded && !expansionLocked) {
        toggleFolder(node.item.id);
        return;
      }

      if (node.parentId) {
        const parentIndex = nodeIndexById.get(node.parentId);
        if (parentIndex !== undefined) {
          selectItem(visibleNodes[parentIndex].item);
          focusItem(node.parentId);
        }
      }
      return;
    }

    if (event.key === "Home") {
      const firstIndex = findNextEnabledIndex(visibleNodes, -1, 1);
      if (firstIndex >= 0) {
        event.preventDefault();
        selectItem(visibleNodes[firstIndex].item);
        focusItem(visibleNodes[firstIndex].item.id);
      }
      return;
    }

    if (event.key === "End") {
      const lastIndex = findNextEnabledIndex(visibleNodes, visibleNodes.length, -1);
      if (lastIndex >= 0) {
        event.preventDefault();
        selectItem(visibleNodes[lastIndex].item);
        focusItem(visibleNodes[lastIndex].item.id);
      }
    }
  }

  return (
    <div
      className={cn(
        showPreview
          ? "grid gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]"
          : "space-y-3",
        className,
      )}
    >
      <div className="space-y-3">
        {showSearch ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryValue}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pr-10 pl-9"
              aria-label={searchPlaceholder}
            />
            {queryValue ? (
              <button
                type="button"
                onClick={() => updateQuery("")}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div
          role="tree"
          aria-label={ariaLabel}
          className={cn(
            "overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/35 p-2",
            treeClassName,
          )}
        >
          {visibleNodes.length > 0 ? (
            <div className="space-y-1">
              {visibleNodes.map((node) => {
                const itemMeta = renderItemMeta?.(node.item) ?? node.item.meta;
                const selected = selectedId === node.item.id;

                return (
                  <div
                    key={node.item.id}
                    className="flex items-center gap-1"
                    style={{ paddingLeft: `${node.depth * 14}px` }}
                  >
                    {node.hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleFolder(node.item.id)}
                        disabled={expansionLocked}
                        aria-label={node.isExpanded ? "Collapse folder" : "Expand folder"}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-8px)] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {node.isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="h-8 w-8 shrink-0" aria-hidden="true" />
                    )}

                    <button
                      ref={(element) => {
                        itemRefs.current[node.item.id] = element;
                      }}
                      type="button"
                      role="treeitem"
                      aria-level={node.depth + 1}
                      aria-selected={selected}
                      aria-expanded={node.hasChildren ? node.isExpanded : undefined}
                      aria-disabled={node.item.disabled || undefined}
                      onClick={() => selectItem(node.item)}
                      onDoubleClick={() => {
                        if (isFolder(node.item) && node.hasChildren && !expansionLocked) {
                          toggleFolder(node.item.id);
                        }
                      }}
                      onKeyDown={(event) => handleItemKeyDown(event, node)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-3 rounded-[calc(var(--radius)-8px)] border border-transparent px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                        selected
                          ? "border-primary/30 bg-primary/12 text-foreground"
                          : "hover:bg-muted/45",
                        node.item.disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="shrink-0 text-muted-foreground">
                        {node.item.icon ??
                          (isFolder(node.item) ? (
                            node.isExpanded ? (
                              <FolderOpen className="h-4 w-4" />
                            ) : (
                              <Folder className="h-4 w-4" />
                            )
                          ) : (
                            <FileIcon className="h-4 w-4" />
                          ))}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {node.item.name}
                        </span>
                        {node.item.description ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {node.item.description}
                          </span>
                        ) : null}
                      </span>

                      {itemMeta ? (
                        <span className="shrink-0 text-xs text-muted-foreground">{itemMeta}</span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground">
              {isEmpty
                ? (emptyState ?? "No files to display.")
                : (noResultsState ?? "No files match the current search.")}
            </div>
          )}
        </div>
      </div>

      {showPreview ? (
        <div
          ref={previewPanelRef}
          className={cn(
            "overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/35",
            previewClassName,
          )}
        >
          {previewFile ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-background/45 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {previewFile.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {previewFile.path ?? "Inline file preview"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canRequestPreview(previewFile, onRequestFileContent) ? (
                    <Button
                      type="button"
                      variant={isPreviewVisible ? "secondary" : "outline"}
                      size="sm"
                      onClick={togglePreviewForSelectedFile}
                    >
                      {isPreviewVisible ? "Hide content" : "View content"}
                    </Button>
                  ) : null}
                  {selectedConfiguredItemActions.map((action) => {
                    const disabled =
                      typeof action.isDisabled === "function"
                        ? action.isDisabled(previewFile)
                        : (action.isDisabled ?? false);

                    return (
                      <Button
                        key={`${previewFile.id}-${action.id}`}
                        type="button"
                        variant={action.variant ?? "outline"}
                        size={action.size ?? "sm"}
                        className={cn(
                          action.size === "icon" ? "h-8 w-8" : "h-8 px-2.5 text-xs",
                          action.className,
                        )}
                        title={action.title}
                        disabled={disabled}
                        onClick={() => action.onClick(previewFile)}
                      >
                        {action.icon}
                        {action.label}
                      </Button>
                    );
                  })}
                  {selectedCustomItemActions}
                  <Badge variant="neutral">{getLanguageLabel(previewFile)}</Badge>
                  <Badge variant="secondary">Read only</Badge>
                </div>
              </div>

              <div className="p-4">
                {!isPreviewVisible ? (
                  <div className="flex min-h-72 items-center justify-center rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/20 px-6 py-10 text-center text-sm text-muted-foreground">
                    Use the View content button to open this file preview.
                  </div>
                ) : selectedFileContentState?.status === "loading" ? (
                  previewLoadingState ?? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Loading file content...
                      </div>
                      <Skeleton className="h-[420px] w-full rounded-[calc(var(--radius)-8px)]" />
                    </div>
                  )
                ) : selectedFileContentState?.status === "error" ? (
                  <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-8px)] border border-dashed border-danger/35 bg-danger/6 px-6 py-10 text-center">
                    <TriangleAlert className="h-5 w-5 text-danger" />
                    <div className="text-sm font-medium text-foreground">
                      Preview unavailable
                    </div>
                    <div className="max-w-md text-sm text-muted-foreground">
                      {selectedFileContentState.message}
                    </div>
                    {onRequestFileContent ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryPreviewLoad(previewFile)}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                ) : previewValue || previewFile.content !== undefined ? (
                  isMarkdownFile(previewFile) ? (
                    <Suspense
                      fallback={
                        <Skeleton className="h-[420px] w-full rounded-[calc(var(--radius)-8px)]" />
                      }
                    >
                      <div
                        className="overflow-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/35 px-5 py-4"
                        style={{ maxHeight: editorHeight }}
                      >
                        <MarkdownContent content={previewValue} />
                      </div>
                    </Suspense>
                  ) : isPlainTextFile(previewFile) ? (
                    <div
                      className="overflow-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/85"
                      style={{ maxHeight: editorHeight }}
                    >
                      <pre className="m-0 p-4 text-[13px] leading-6 whitespace-pre-wrap break-words text-foreground">
                        {previewValue}
                      </pre>
                    </div>
                  ) : (
                    <Suspense
                      fallback={
                        <Skeleton className="h-[420px] w-full rounded-[calc(var(--radius)-8px)]" />
                      }
                    >
                      <FileCodePreview
                        file={previewFile}
                        content={previewValue}
                        height={editorHeight}
                      />
                    </Suspense>
                  )
                ) : (
                  previewUnavailableState ?? (
                    <div className="flex min-h-72 items-center justify-center rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/20 px-6 py-10 text-center text-sm text-muted-foreground">
                      This file does not provide preview content.
                    </div>
                  )
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[520px] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
              {previewEmptyState ?? "Select a file to open it in the preview pane."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
