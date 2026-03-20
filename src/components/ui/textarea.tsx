import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-40 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-ring/30",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
