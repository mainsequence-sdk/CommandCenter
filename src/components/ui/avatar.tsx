import { User } from "lucide-react";

import { cn } from "@/lib/utils";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }

  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts.at(-1) ?? "")[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function Avatar({
  name,
  src,
  className,
  iconClassName,
}: {
  name: string;
  src?: string;
  className?: string;
  iconClassName?: string;
}) {
  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-foreground",
        className,
      )}
      aria-label={name}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : initials ? (
        <span className="text-[11px] font-semibold tracking-[0.14em] text-foreground">
          {initials}
        </span>
      ) : (
        <User className={cn("h-4 w-4 text-muted-foreground", iconClassName)} aria-hidden="true" />
      )}
    </div>
  );
}
