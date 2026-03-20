import { useEffect, useState } from "react";

import { Loader2, Plus } from "lucide-react";

import { getAppPath } from "@/apps/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import {
  formatMainSequenceError,
  type CreateExecutionVenueInput,
  type ExecutionVenueListRow,
  type ExecutionVenueRecord,
  type UpdateExecutionVenueInput,
} from "../../../../common/api";

export type ExecutionVenueEditorMode = "create" | "edit";

export type ExecutionVenueEditorValues = {
  symbol: string;
  name: string;
};

export function getExecutionVenuesListPath() {
  return getAppPath("main_sequence_markets", "execution-venues");
}

export function getExecutionVenueDetailPath(executionVenueId: number) {
  return `${getExecutionVenuesListPath()}/${executionVenueId}`;
}

export function formatExecutionVenueValue(value: string | null | undefined, fallback = "Not available") {
  const normalized = value?.trim();

  return normalized || fallback;
}

export function buildExecutionVenueListRow(
  executionVenue: ExecutionVenueRecord,
): ExecutionVenueListRow {
  return {
    id: executionVenue.id,
    symbol: executionVenue.symbol,
    name: executionVenue.name,
  };
}

export function buildExecutionVenueInitialValues(
  executionVenue?: ExecutionVenueRecord | null,
): ExecutionVenueEditorValues {
  return {
    symbol: executionVenue?.symbol?.trim() || "",
    name: executionVenue?.name?.trim() || "",
  };
}

export function buildExecutionVenueCreatePayload(
  values: ExecutionVenueEditorValues,
): CreateExecutionVenueInput {
  const symbol = values.symbol.trim();
  const name = values.name.trim();

  if (!symbol) {
    throw new Error("Symbol is required.");
  }

  if (!name) {
    throw new Error("Name is required.");
  }

  return {
    symbol,
    name,
  };
}

export function buildExecutionVenueUpdatePayload(
  values: ExecutionVenueEditorValues,
): UpdateExecutionVenueInput {
  return buildExecutionVenueCreatePayload(values);
}

export function buildExecutionVenueDeleteSummary(venues: ExecutionVenueListRow[]) {
  if (venues.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {venues.slice(0, 5).map((venue) => (
        <div key={venue.id} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {formatExecutionVenueValue(venue.symbol, `Venue ${venue.id}`)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {formatExecutionVenueValue(venue.name)}
            </div>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">ID {venue.id}</div>
        </div>
      ))}
      {venues.length > 5 ? (
        <div className="text-xs text-muted-foreground">
          {`${venues.length - 5} more selected execution venues`}
        </div>
      ) : null}
    </div>
  );
}

export function ExecutionVenueEditorDialog({
  mode,
  open,
  onClose,
  onSubmit,
  isPending,
  error,
  initialValues,
}: {
  mode: ExecutionVenueEditorMode;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ExecutionVenueEditorValues) => void;
  isPending: boolean;
  error: unknown;
  initialValues: ExecutionVenueEditorValues;
}) {
  const [values, setValues] = useState<ExecutionVenueEditorValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(initialValues);
    setValidationError(null);
  }, [initialValues, open]);

  const isEditMode = mode === "edit";

  return (
    <Dialog
      title={isEditMode ? "Edit execution venue" : "Create execution venue"}
      description={
        isEditMode
          ? "Update the execution venue symbol and name."
          : "Create a new execution venue from the migrated DRF endpoint."
      }
      open={open}
      onClose={() => {
        if (!isPending) {
          onClose();
        }
      }}
      className="max-w-[min(560px,calc(100vw-24px))]"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Symbol
            </label>
            <Input
              autoFocus
              value={values.symbol}
              onChange={(event) => {
                setValidationError(null);
                setValues((current) => ({
                  ...current,
                  symbol: event.target.value,
                }));
              }}
              placeholder="BINANCE"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Name
            </label>
            <Input
              value={values.name}
              onChange={(event) => {
                setValidationError(null);
                setValues((current) => ({
                  ...current,
                  name: event.target.value,
                }));
              }}
              placeholder="Binance"
            />
          </div>
        </div>

        {validationError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {validationError}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(error)}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const symbol = values.symbol.trim();
              const name = values.name.trim();

              if (!symbol) {
                setValidationError("Symbol is required.");
                return;
              }

              if (!name) {
                setValidationError("Name is required.");
                return;
              }

              onSubmit({
                symbol,
                name,
              });
            }}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isEditMode ? "Save changes" : "Create venue"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
