import { useEffect, useState, type ReactNode } from "react";

import { AlertTriangle, Loader2, ShieldAlert, Siren } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./input";
import { useToast } from "./toaster";

type ActionConfirmationDialogTone = "primary" | "warning" | "danger";
type ActionConfirmationDialogToastVariant = "success" | "error" | "info";

type ActionConfirmationDialogToastConfig<T> = {
  description?: string | ((value: T) => string | undefined);
  title: string | ((value: T) => string);
  variant?: ActionConfirmationDialogToastVariant;
};

const toneStyles: Record<
  ActionConfirmationDialogTone,
  {
    confirmButtonVariant: "default" | "danger";
    headerClassName: string;
    noteClassName: string;
    toneClassName: string;
  }
> = {
  primary: {
    confirmButtonVariant: "default",
    headerClassName:
      "border-b-primary/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.18)_0%,rgba(29,78,216,0.08)_100%)]",
    noteClassName: "border-primary/30 bg-primary/10 text-primary",
    toneClassName: "text-primary",
  },
  warning: {
    confirmButtonVariant: "default",
    headerClassName:
      "border-b-warning/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.18)_0%,rgba(180,83,9,0.08)_100%)]",
    noteClassName: "border-warning/30 bg-warning/10 text-warning",
    toneClassName: "text-warning",
  },
  danger: {
    confirmButtonVariant: "danger",
    headerClassName:
      "border-b-danger/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.18)_0%,rgba(159,18,57,0.08)_100%)]",
    noteClassName: "border-danger/30 bg-danger/10 text-danger",
    toneClassName: "text-danger",
  },
};

function ToneIcon({ tone }: { tone: ActionConfirmationDialogTone }) {
  if (tone === "danger") {
    return <Siren className="h-4 w-4" />;
  }

  if (tone === "warning") {
    return <AlertTriangle className="h-4 w-4" />;
  }

  return <ShieldAlert className="h-4 w-4" />;
}

export function ActionConfirmationDialog({
  actionLabel,
  confirmButtonLabel,
  confirmWord,
  description,
  error,
  isPending = false,
  objectLabel,
  objectSummary,
  onClose,
  onConfirm,
  onError,
  onSuccess,
  open,
  errorToast,
  specialText,
  successToast,
  title,
  tone = "danger",
}: {
  actionLabel: string;
  confirmButtonLabel: string;
  confirmWord: string;
  description?: ReactNode;
  error?: ReactNode;
  errorToast?: ActionConfirmationDialogToastConfig<unknown>;
  isPending?: boolean;
  objectLabel: string;
  objectSummary?: ReactNode;
  onClose: () => void;
  onConfirm: () => Promise<unknown> | unknown;
  onError?: (error: unknown) => void | Promise<void>;
  onSuccess?: (result: unknown) => void | Promise<void>;
  open: boolean;
  specialText?: ReactNode;
  successToast?: ActionConfirmationDialogToastConfig<unknown>;
  title: string;
  tone?: ActionConfirmationDialogTone;
}) {
  const { toast } = useToast();
  const [confirmationValue, setConfirmationValue] = useState("");
  const [internalError, setInternalError] = useState<ReactNode | undefined>();
  const [internalPending, setInternalPending] = useState(false);
  const activeTone = toneStyles[tone];
  const canConfirm = confirmationValue.trim() === confirmWord;
  const resolvedError = error ?? internalError;
  const resolvedPending = isPending || internalPending;

  useEffect(() => {
    setConfirmationValue("");
    setInternalError(undefined);
    setInternalPending(false);
  }, [confirmWord, open]);

  function resolveToastCopy<T>(
    config: ActionConfirmationDialogToastConfig<T> | undefined,
    value: T,
  ) {
    if (!config) {
      return null;
    }

    return {
      title: typeof config.title === "function" ? config.title(value) : config.title,
      description:
        typeof config.description === "function"
          ? config.description(value)
          : config.description,
      variant: config.variant,
    };
  }

  async function handleConfirm() {
    setInternalError(undefined);
    setInternalPending(true);

    try {
      const result = await onConfirm();
      const successToastConfig = resolveToastCopy(successToast, result);

      if (successToastConfig) {
        toast({
          title: successToastConfig.title,
          description: successToastConfig.description,
          variant: successToastConfig.variant ?? "success",
        });
      }

      await onSuccess?.(result);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : typeof caughtError === "string"
            ? caughtError
            : "Action failed.";

      setInternalError(nextError);

      const errorToastConfig = resolveToastCopy(errorToast, caughtError);
      if (errorToastConfig) {
        toast({
          title: errorToastConfig.title,
          description: errorToastConfig.description,
          variant: errorToastConfig.variant ?? "error",
        });
      }

      await onError?.(caughtError);
    } finally {
      setInternalPending(false);
    }
  }

  return (
    <Dialog
      title={title}
      open={open}
      onClose={onClose}
      className="max-w-[min(680px,calc(100vw-24px))]"
      headerClassName={activeTone.headerClassName}
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <div className={cn("inline-flex items-center gap-2 text-sm font-medium", activeTone.toneClassName)}>
            <ToneIcon tone={tone} />
            <span>{title}</span>
          </div>
          <p className="text-sm leading-6 text-foreground">
            Are you sure you want to <span className="font-semibold text-foreground">"{actionLabel}"</span>{" "}
            the following {objectLabel}? Confirm by typing{" "}
            <span className="rounded-md border border-border/70 bg-background/45 px-2 py-1 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
              {confirmWord}
            </span>
            .
          </p>
          {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        </div>

        {specialText ? (
          <div
            className={cn(
              "rounded-[calc(var(--radius)-6px)] border px-4 py-3 text-sm leading-6",
              activeTone.noteClassName,
            )}
          >
            {specialText}
          </div>
        ) : null}

        {objectSummary ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 px-4 py-3 text-sm text-foreground">
            {objectSummary}
          </div>
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor="action-confirmation-word"
            className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Confirmation word
          </label>
          <Input
            id="action-confirmation-word"
            value={confirmationValue}
            onChange={(event) => setConfirmationValue(event.target.value)}
            placeholder={confirmWord}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="text-xs text-muted-foreground">
            Type <span className="font-mono text-foreground">{confirmWord}</span> exactly to continue.
          </div>
        </div>

        {resolvedError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {resolvedError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={resolvedPending}>
            Cancel
          </Button>
          <Button
            variant={activeTone.confirmButtonVariant}
            disabled={resolvedPending || !canConfirm}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {resolvedPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ToneIcon tone={tone} />}
            {confirmButtonLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
