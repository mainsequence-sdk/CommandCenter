import type { HTMLAttributes } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted/70 text-muted-foreground",
        primary: "border-primary/30 bg-primary/10 text-primary",
        secondary: "border-border bg-secondary/80 text-secondary-foreground",
        success: "border-success/30 bg-success/12 text-success",
        warning: "border-warning/30 bg-warning/12 text-warning",
        danger: "border-danger/30 bg-danger/12 text-danger",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
