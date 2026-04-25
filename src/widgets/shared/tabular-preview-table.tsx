import { cn } from "@/lib/utils";
import { widgetExtraTightTableClass } from "@/widgets/shared/form-density";

function formatPreviewValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? new Intl.NumberFormat("en-US").format(value)
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function TabularPreviewTable({
  className,
  columns,
  emptyMessage = "No rows are available.",
  maxRows = 20,
  rows,
}: {
  className?: string;
  columns: string[];
  emptyMessage?: string;
  maxRows?: number;
  rows: Array<Record<string, unknown>>;
}) {
  if (rows.length === 0 || columns.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[220px] items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  const displayedRows = rows.slice(0, maxRows);

  return (
    <div
      className={cn(
        "h-full overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35",
        widgetExtraTightTableClass,
        className,
      )}
    >
      <table className="w-full min-w-[640px] border-separate border-spacing-y-0 text-xs">
        <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-border/70 px-2.5 py-[var(--table-compact-header-padding-y)]"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayedRows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${columns.map((column) => String(row[column] ?? "")).join("|")}`}>
              {columns.map((column, columnIndex) => (
                <td
                  key={`${rowIndex}-${column}`}
                  className={cn(
                    "border-b border-border/50 px-2.5 py-[var(--table-compact-cell-padding-y)] align-top text-foreground",
                    columnIndex === 0 ? "font-mono text-[11px]" : "text-[11px]",
                  )}
                >
                  {formatPreviewValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > displayedRows.length ? (
        <div className="border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
          Showing the first {displayedRows.length.toLocaleString()} rows of{" "}
          {rows.length.toLocaleString()}.
        </div>
      ) : null}
    </div>
  );
}
