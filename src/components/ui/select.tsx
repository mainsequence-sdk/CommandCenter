import * as React from "react";

import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
