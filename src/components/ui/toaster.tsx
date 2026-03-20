import { useEffect } from "react";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { createPortal } from "react-dom";
import { create } from "zustand";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface ToastInput {
  title: string;
  description?: string;
  duration?: number;
  variant?: ToastVariant;
}

interface ToastRecord extends ToastInput {
  id: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastRecord[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const toastTimeouts = new Map<string, number>();

function dismissToast(id: string) {
  const timeoutId = toastTimeouts.get(id);

  if (timeoutId) {
    window.clearTimeout(timeoutId);
    toastTimeouts.delete(id);
  }

  useToastStore.setState((current) => ({
    toasts: current.toasts.filter((toast) => toast.id !== id),
  }));
}

function scheduleToastDismiss(id: string, duration = 4500) {
  if (typeof window === "undefined" || duration <= 0) {
    return;
  }

  const existingTimeoutId = toastTimeouts.get(id);
  if (existingTimeoutId) {
    window.clearTimeout(existingTimeoutId);
  }

  const timeoutId = window.setTimeout(() => {
    dismissToast(id);
  }, duration);

  toastTimeouts.set(id, timeoutId);
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push(input) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const nextToast: ToastRecord = {
      id,
      variant: input.variant ?? "info",
      title: input.title,
      description: input.description,
      duration: input.duration,
    };

    set((current) => ({
      toasts: [...current.toasts, nextToast].slice(-5),
    }));

    scheduleToastDismiss(id, input.duration);

    return id;
  },
  dismiss(id) {
    dismissToast(id);
  },
}));

export function useToast() {
  const push = useToastStore((state) => state.push);
  const dismiss = useToastStore((state) => state.dismiss);

  return {
    toast: push,
    dismiss,
  };
}

function toastStylesForVariant(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return {
        icon: CheckCircle2,
        iconClassName: "text-success",
        accentClassName: "border-success/35 bg-success/12",
      };
    case "error":
      return {
        icon: CircleAlert,
        iconClassName: "text-danger",
        accentClassName: "border-danger/35 bg-danger/12",
      };
    default:
      return {
        icon: Info,
        iconClassName: "text-primary",
        accentClassName: "border-primary/35 bg-primary/12",
      };
  }
}

function ToastCard({
  description,
  id,
  title,
  variant,
}: ToastRecord) {
  const dismiss = useToastStore((state) => state.dismiss);
  const { accentClassName, icon: Icon, iconClassName } = toastStylesForVariant(variant);

  return (
    <div
      className="pointer-events-auto relative overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-[linear-gradient(180deg,rgba(10,15,27,0.96)_0%,rgba(7,11,21,0.98)_100%)] text-card-foreground shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", accentClassName)} />
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span
          className={cn(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04]",
            iconClassName,
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{title}</div>
          {description ? (
            <div className="mt-1 text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          onClick={() => dismiss(id)}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  useEffect(() => {
    return () => {
      toastTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      toastTimeouts.clear();
    };
  }, []);

  if (typeof document === "undefined" || toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[150] flex items-start justify-end p-4 sm:p-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} {...toast} />
        ))}
      </div>
    </div>,
    document.body,
  );
}
