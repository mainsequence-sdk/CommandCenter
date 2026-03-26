import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

interface DataNodeHoverPanelDetail {
  label: string;
  value: ReactNode;
}

export function DataNodeHoverPanel({
  title,
  description,
  subtitle = "Data Node",
  details,
  Icon,
  iconToneClass,
  spinning = false,
}: {
  title: string;
  description: string;
  subtitle?: string;
  details: DataNodeHoverPanelDetail[];
  Icon: LucideIcon;
  iconToneClass: string;
  spinning?: boolean;
}) {
  return (
    <div className="pointer-events-none z-20 w-[260px] rounded-[calc(var(--radius)-4px)] border border-border/80 bg-popover/95 p-3 text-left shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${iconToneClass}`}>
          <Icon className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">{description}</p>

      <div className="mt-3 space-y-1.5 text-xs">
        {details.map((detail) => (
          <div key={detail.label} className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">{detail.label}</span>
            <span className="max-w-[160px] text-right font-medium text-foreground">
              {detail.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
