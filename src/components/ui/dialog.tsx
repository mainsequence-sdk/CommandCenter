import { useEffect, type ReactNode } from "react";

import { X } from "lucide-react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface DialogProps {
  children: ReactNode;
  className?: string;
  closeOnBackdropClick?: boolean;
  contentClassName?: string;
  description?: string;
  headerClassName?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function Dialog({
  children,
  className,
  closeOnBackdropClick = false,
  contentClassName,
  description,
  headerClassName,
  onClose,
  open,
  title,
}: DialogProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-5">
      {closeOnBackdropClick ? (
        <button
          type="button"
          className="absolute inset-0 bg-background/70 backdrop-blur-md"
          aria-label="Close dialog"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-md" aria-hidden="true" />
      )}
      <div
        className={cn(
          "relative z-10 flex w-full max-w-[min(1120px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(155deg,color-mix(in_srgb,var(--card)_92%,var(--background)_8%)_0%,color-mix(in_srgb,var(--card)_96%,var(--background)_4%)_46%,color-mix(in_srgb,var(--background)_94%,var(--card)_6%)_100%)] text-card-foreground shadow-[0_32px_120px_rgba(0,0,0,0.34)] backdrop-blur-2xl",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-description" : undefined}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 top-[-120px] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-[-160px] right-[-80px] h-80 w-80 rounded-full bg-accent/8 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--foreground)_6%,transparent)_0%,color-mix(in_srgb,var(--foreground)_2%,transparent)_32%,transparent_100%)]" />
        </div>
        <div
          className={cn(
            "relative flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 md:px-6",
            headerClassName,
          )}
        >
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-base font-semibold text-topbar-foreground">
              {title}
            </h2>
            {description ? (
              <p id="dialog-description" className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-topbar-foreground"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className={cn(
            "relative max-h-[min(84vh,860px)] overflow-auto px-5 py-5 md:px-6 md:py-6",
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
