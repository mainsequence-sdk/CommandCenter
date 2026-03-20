import { forwardRef, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export const MainSequenceSelectionCheckbox = forwardRef<
  HTMLInputElement,
  {
    ariaLabel: string;
    checked: boolean;
    className?: string;
    indeterminate?: boolean;
    onChange: () => void;
  }
>(({ ariaLabel, checked, className, indeterminate = false, onChange }, forwardedRef) => {
  const localRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (localRef.current) {
      localRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={(element) => {
        localRef.current = element;

        if (typeof forwardedRef === "function") {
          forwardedRef(element);
        } else if (forwardedRef) {
          forwardedRef.current = element;
        }
      }}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={() => onChange()}
      className={cn(
        "h-4 w-4 cursor-pointer rounded border-border/70 bg-card/70 accent-primary shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    />
  );
});

MainSequenceSelectionCheckbox.displayName = "MainSequenceSelectionCheckbox";
