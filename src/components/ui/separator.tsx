import { cn } from "@/lib/utils";

export function Separator({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <div
      className={cn(
        orientation === "horizontal"
          ? "h-px w-full bg-border/70"
          : "h-full w-px bg-border/70",
        className,
      )}
    />
  );
}
