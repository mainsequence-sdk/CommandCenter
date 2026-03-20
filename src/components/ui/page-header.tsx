import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  style,
}: {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
      style={style}
    >
      <div className="space-y-1.5">
        {eyebrow ? (
          <div
            className="uppercase tracking-[0.18em] text-muted-foreground"
            style={{ fontSize: "var(--font-size-body-xs)" }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          className="font-semibold tracking-tight text-foreground"
          style={{ fontSize: "var(--font-size-page-title)" }}
        >
          {title}
        </h1>
        {description ? (
          <p
            className="max-w-3xl text-muted-foreground"
            style={{
              fontSize: "var(--font-size-body-sm)",
              lineHeight: "var(--line-height-body)",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
