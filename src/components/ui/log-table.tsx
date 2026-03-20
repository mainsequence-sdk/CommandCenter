import { Fragment, type ReactNode, useMemo, useState } from "react";

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Clock3, Logs } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "notice"
  | "warn"
  | "warning"
  | "error"
  | "critical"
  | "fatal"
  | string;

export interface LogTableEntry {
  id: string;
  message: string;
  timestamp?: string | number | Date | null;
  level?: LogLevel | null;
  source?: string | null;
  durationMs?: number | null;
  status?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  context?: Record<string, unknown> | null;
  children?: LogTableEntry[] | null;
}

export type LogTableColumnId = "timestamp" | "level" | "source" | "message" | "duration";

interface LogTableProps {
  logs: LogTableEntry[];
  className?: string;
  columns?: LogTableColumnId[];
  defaultExpandAll?: boolean;
  emptyMessage?: string;
  expanded?: ExpandedState;
  extraColumns?: ColumnDef<LogTableEntry>[];
  getRowCanExpand?: (entry: LogTableEntry) => boolean;
  getSubRows?: (entry: LogTableEntry) => LogTableEntry[] | undefined;
  onExpandedChange?: (expanded: ExpandedState) => void;
  onRowClick?: (entry: LogTableEntry) => void;
  renderExpandedContent?: (entry: LogTableEntry) => ReactNode;
  renderRowActions?: (entry: LogTableEntry) => ReactNode;
  stickyHeader?: boolean;
}

const defaultColumns: LogTableColumnId[] = ["timestamp", "level", "source", "message", "duration"];

function resolveExpandedState(
  updater: ExpandedState | ((previous: ExpandedState) => ExpandedState),
  previous: ExpandedState,
) {
  return typeof updater === "function" ? updater(previous) : updater;
}

function toTimestampLabel(value: LogTableEntry["timestamp"]) {
  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  const timestamp =
    value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    hour12: false,
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function toDurationLabel(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 2)} s`;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
}

function getLevelVariant(level: LogLevel | null | undefined) {
  switch ((level ?? "").toString().toLowerCase()) {
    case "fatal":
    case "critical":
    case "error":
      return "danger" as const;
    case "warn":
    case "warning":
      return "warning" as const;
    case "info":
    case "notice":
      return "primary" as const;
    case "debug":
    case "trace":
      return "secondary" as const;
    default:
      return "neutral" as const;
  }
}

function hasContext(entry: LogTableEntry) {
  return Boolean(entry.context && Object.keys(entry.context).length > 0);
}

function hasInlineDetails(entry: LogTableEntry) {
  return Boolean(
    entry.summary?.trim() ||
      entry.status?.trim() ||
      (entry.tags?.length ?? 0) > 0 ||
      hasContext(entry),
  );
}

function stringifyContext(entry: LogTableEntry) {
  if (!entry.context) {
    return "";
  }

  try {
    return JSON.stringify(entry.context, null, 2);
  } catch {
    return String(entry.context);
  }
}

function DefaultExpandedContent({ entry }: { entry: LogTableEntry }) {
  if (!hasInlineDetails(entry)) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_240px]">
      <div className="min-w-0 space-y-3">
        {entry.summary?.trim() ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Summary
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {entry.summary}
            </div>
          </div>
        ) : null}

        {hasContext(entry) ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Context
            </div>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-muted-foreground">
              {stringifyContext(entry)}
            </pre>
          </div>
        ) : null}
      </div>

      <aside className="space-y-3">
        {entry.status?.trim() ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Status
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">{entry.status}</div>
          </div>
        ) : null}

        {entry.tags?.length ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Tags
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function LogTable({
  logs,
  className,
  columns = defaultColumns,
  defaultExpandAll = false,
  emptyMessage = "No logs available.",
  expanded,
  extraColumns,
  getRowCanExpand,
  getSubRows,
  onExpandedChange,
  onRowClick,
  renderExpandedContent,
  renderRowActions,
  stickyHeader = true,
}: LogTableProps) {
  const [internalExpanded, setInternalExpanded] = useState<ExpandedState>(
    defaultExpandAll ? true : {},
  );

  const expandedState = expanded ?? internalExpanded;
  const controlledExpanded = expanded !== undefined;
  const resolveSubRows = getSubRows ?? ((entry: LogTableEntry) => entry.children ?? undefined);

  const columnDefs = useMemo<ColumnDef<LogTableEntry>[]>(() => {
    const builtIns: Record<LogTableColumnId, ColumnDef<LogTableEntry>> = {
      timestamp: {
        id: "timestamp",
        header: "Timestamp",
        cell: ({ row }) => (
          <div className="min-w-[148px] font-mono text-[12px] text-muted-foreground">
            {toTimestampLabel(row.original.timestamp)}
          </div>
        ),
      },
      level: {
        id: "level",
        header: "Level",
        cell: ({ row }) => (
          <Badge variant={getLevelVariant(row.original.level)}>
            {(row.original.level ?? "log").toString()}
          </Badge>
        ),
      },
      source: {
        id: "source",
        header: "Source",
        cell: ({ row }) => (
          <div className="max-w-[220px] truncate text-[12px] text-muted-foreground">
            {row.original.source?.trim() || "—"}
          </div>
        ),
      },
      message: {
        id: "message",
        header: "Message",
        cell: ({ row }) => {
          const canExpand = row.getCanExpand();

          return (
            <div className="min-w-0">
              <div
                className="flex min-w-0 items-start gap-2"
                style={{ paddingLeft: `${row.depth * 18}px` }}
              >
                <button
                  type="button"
                  disabled={!canExpand}
                  tabIndex={canExpand ? 0 : -1}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-transparent text-muted-foreground transition-colors",
                    canExpand
                      ? "hover:border-border/70 hover:bg-muted/60 hover:text-foreground"
                      : "pointer-events-none opacity-0",
                  )}
                  aria-label={row.getIsExpanded() ? "Collapse log row" : "Expand log row"}
                  onClick={(event) => {
                    event.stopPropagation();
                    row.toggleExpanded();
                  }}
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {row.original.message}
                  </div>
                  {row.original.summary?.trim() ? (
                    <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {row.original.summary}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        },
      },
      duration: {
        id: "duration",
        header: "Duration",
        cell: ({ row }) => (
          <div className="flex min-w-[84px] items-center gap-1.5 whitespace-nowrap font-mono text-[12px] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {toDurationLabel(row.original.durationMs)}
          </div>
        ),
      },
    };

    const selectedColumns = columns.map((columnId) => builtIns[columnId]);

    if (extraColumns?.length) {
      selectedColumns.push(...extraColumns);
    }

    if (renderRowActions) {
      selectedColumns.push({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {renderRowActions(row.original)}
          </div>
        ),
      });
    }

    return selectedColumns;
  }, [columns, extraColumns, renderRowActions]);

  const table = useReactTable({
    data: logs,
    columns: columnDefs,
    state: {
      expanded: expandedState,
    },
    getRowId: (entry) => entry.id,
    getSubRows: resolveSubRows,
    getRowCanExpand: (row) => {
      if (getRowCanExpand) {
        return getRowCanExpand(row.original);
      }

      return (resolveSubRows(row.original)?.length ?? 0) > 0 || hasInlineDetails(row.original);
    },
    onExpandedChange: (updater) => {
      const next = resolveExpandedState(updater, expandedState);

      if (!controlledExpanded) {
        setInternalExpanded(next);
      }

      onExpandedChange?.(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length || 1;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/70 bg-card/75",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead
            className={cn(
              "bg-background/80",
              stickyHeader && "sticky top-0 z-[1] backdrop-blur supports-[backdrop-filter]:bg-background/75",
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-border/70 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const expandedContent = renderExpandedContent
                  ? renderExpandedContent(row.original)
                  : hasInlineDetails(row.original)
                    ? <DefaultExpandedContent entry={row.original} />
                    : null;
                const showExpandedContent = row.getIsExpanded() && Boolean(expandedContent);

                return (
                  <Fragment key={row.id}>
                    <tr
                      className={cn(
                        "border-b border-border/50 transition-colors",
                        (row.getCanExpand() || onRowClick) &&
                          "cursor-pointer hover:bg-muted/35",
                      )}
                      onClick={() => {
                        if (row.getCanExpand()) {
                          row.toggleExpanded();
                        }

                        onRowClick?.(row.original);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="border-b border-border/50 px-3 py-2 align-top">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>

                    {showExpandedContent ? (
                      <tr className="bg-background/45">
                        <td
                          colSpan={visibleColumnCount}
                          className="border-b border-border/50 px-3 py-3"
                        >
                          <div
                            className="min-w-0 rounded-[calc(var(--radius)-6px)] border border-border/60 bg-card/70 p-3"
                            style={{ marginLeft: `${row.depth * 18 + 28}px` }}
                          >
                            {expandedContent}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={visibleColumnCount} className="px-4 py-10">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-muted/50 text-muted-foreground">
                      <Logs className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-medium text-foreground">No logs</div>
                    <div className="max-w-[420px] text-sm text-muted-foreground">
                      {emptyMessage}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
