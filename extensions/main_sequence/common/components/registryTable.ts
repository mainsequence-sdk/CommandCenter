import { cn } from "@/lib/utils";

export function getRegistryTableCellClassName(
  selected: boolean,
  edge: "left" | "middle" | "right" = "middle",
) {
  return cn(
    "border px-4 py-[var(--table-standard-cell-padding-y)]",
    edge === "left" ? "rounded-l-[calc(var(--radius)-6px)]" : null,
    edge === "right" ? "rounded-r-[calc(var(--radius)-6px)]" : null,
    edge !== "right" ? "border-r-0" : null,
    selected ? "border-primary/40 bg-primary/10" : "border-border/70 bg-background/38",
  );
}
