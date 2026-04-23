import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export function WidgetSettingHelp({
  className,
  content,
}: {
  className?: string;
  content: ReactNode;
}) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || typeof window === "undefined") {
      return;
    }

    function updateTooltipPosition() {
      const triggerBounds = triggerRef.current?.getBoundingClientRect();

      if (!triggerBounds) {
        return;
      }

      const tooltipWidth = Math.min(260, Math.max(180, window.innerWidth - 24));
      const left = Math.min(
        triggerBounds.right + 10,
        Math.max(12, window.innerWidth - tooltipWidth - 12),
      );
      const top = Math.min(
        Math.max(triggerBounds.top + triggerBounds.height / 2, 20),
        Math.max(20, window.innerHeight - 20),
      );

      setTooltipStyle({
        left,
        top,
        width: tooltipWidth,
      });
    }

    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={typeof content === "string" ? content : "Show field help"}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/70 text-[10px] font-semibold normal-case leading-none text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
          className,
        )}
        onPointerEnter={() => {
          setOpen(true);
        }}
        onPointerLeave={() => {
          setOpen(false);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        i
      </button>
      {open && tooltipStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[120] -translate-y-1/2 rounded-[calc(var(--radius)-6px)] border border-border/80 bg-popover px-2.5 py-2 text-left text-[11px] font-medium leading-4 text-popover-foreground shadow-[var(--shadow-panel)]"
              style={tooltipStyle}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function WidgetSettingFieldLabel({
  children,
  className,
  help,
  htmlFor,
  required,
  textClassName,
}: {
  children: ReactNode;
  className?: string;
  help?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  textClassName?: string;
}) {
  const labelContent = htmlFor ? (
    <label htmlFor={htmlFor} className={cn("min-w-0 truncate", textClassName)}>
      {children}
    </label>
  ) : (
    <span className={cn("min-w-0 truncate", textClassName)}>
      {children}
    </span>
  );

  return (
    <div className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {labelContent}
      {required ? <span className="shrink-0 text-danger">*</span> : null}
      {help ? <WidgetSettingHelp content={help} /> : null}
    </div>
  );
}
