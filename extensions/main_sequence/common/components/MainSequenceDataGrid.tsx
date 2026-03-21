import type { CSSProperties } from "react";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Database } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MainSequenceDataGridProps<TData extends object> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  className?: string;
  emptyMessage?: string;
  emptyTitle?: string;
  stickyHeader?: boolean;
  tableMinWidth?: CSSProperties["minWidth"];
}

export function MainSequenceDataGrid<TData extends object>({
  data,
  columns,
  className,
  emptyMessage = "No rows were returned.",
  emptyTitle = "No rows",
  stickyHeader = true,
  tableMinWidth = 760,
}: MainSequenceDataGridProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
        <table
          className="w-full border-collapse text-left"
          style={{ minWidth: tableMinWidth }}
        >
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
                    className="border-b border-border/70 px-3 py-[var(--table-compact-header-padding-y)] text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
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
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumnCount} className="px-4 py-10">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-muted/50 text-muted-foreground">
                      <Database className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-medium text-foreground">{emptyTitle}</div>
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
