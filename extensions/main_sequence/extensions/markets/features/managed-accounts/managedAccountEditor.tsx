import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  formatMainSequenceError,
  listExecutionVenues,
  listManagedAccountHoldingsDataSources,
  type CreateManagedAccountInput,
} from "../../../../common/api";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";

export type ManagedAccountEditorValues = {
  accountName: string;
  executionVenueUid: string;
  isPaper: boolean;
  holdingsDataSourceId: string;
};

export function buildManagedAccountInitialValues(): ManagedAccountEditorValues {
  return {
    accountName: "",
    executionVenueUid: "",
    isPaper: true,
    holdingsDataSourceId: "",
  };
}

export function buildManagedAccountCreatePayload(
  values: ManagedAccountEditorValues,
): CreateManagedAccountInput {
  const accountName = values.accountName.trim();
  const executionVenueUid = values.executionVenueUid.trim();

  if (!accountName) {
    throw new Error("Account name is required.");
  }

  if (!executionVenueUid) {
    throw new Error("Execution venue is required.");
  }

  const holdingsDataSourceId = values.holdingsDataSourceId.trim()
    ? Number(values.holdingsDataSourceId)
    : null;

  return {
    account_name: accountName,
    execution_venue: executionVenueUid,
    is_paper: values.isPaper,
    holdings_data_source:
      holdingsDataSourceId && Number.isFinite(holdingsDataSourceId)
        ? holdingsDataSourceId
        : null,
  };
}

export function ManagedAccountEditorDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ManagedAccountEditorValues) => void;
  isPending: boolean;
  error: unknown;
}) {
  const [values, setValues] = useState<ManagedAccountEditorValues>(
    buildManagedAccountInitialValues(),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const executionVenuesQuery = useQuery({
    queryKey: ["main_sequence", "execution_venues", "account-create-options"],
    queryFn: () => listExecutionVenues({ limit: 200, offset: 0 }),
    enabled: open,
    staleTime: 300_000,
  });

  const holdingsDataSourcesQuery = useQuery({
    queryKey: ["main_sequence", "managed_accounts", "holdings_data_sources", "account-create-options"],
    queryFn: () => listManagedAccountHoldingsDataSources({ limit: 200, offset: 0 }),
    enabled: open,
    staleTime: 300_000,
  });

  const executionVenueOptions = useMemo<PickerOption[]>(
    () =>
      (executionVenuesQuery.data?.results ?? []).map((venue) => ({
        value: venue.uid,
        label: venue.name?.trim() || venue.symbol?.trim() || "Execution venue",
        description: venue.symbol?.trim() || undefined,
        keywords: [venue.name ?? "", venue.symbol ?? "", venue.uid ?? ""],
      })),
    [executionVenuesQuery.data?.results],
  );

  const holdingsDataSourceRows = holdingsDataSourcesQuery.data?.results ?? [];
  const hasDefaultHoldingsDataSource = holdingsDataSourceRows.some((source) => {
    const metadata = source.metadata;
    const metadataDefault =
      metadata && typeof metadata === "object" && "is_default_data_source" in metadata
        ? metadata.is_default_data_source
        : undefined;

    return source.is_default_data_source === true || metadataDefault === true;
  });

  const holdingsDataSourceOptions = useMemo<PickerOption[]>(
    () => [
      ...(hasDefaultHoldingsDataSource
        ? [
            {
              value: "",
              label: "Use organization default",
              description:
                "Leave empty to use the organization default holdings data source.",
            } satisfies PickerOption,
          ]
        : []),
      ...holdingsDataSourceRows.map((source) => ({
        value: String(source.id),
        label: source.display_name?.trim() || `Data source ${source.id}`,
        description: [source.class_type?.trim(), source.status?.trim()].filter(Boolean).join(" · ") || source.description?.trim() || undefined,
        keywords: [
          source.display_name ?? "",
          source.class_type ?? "",
          source.status ?? "",
          source.description ?? "",
          String(source.id),
        ],
      })),
    ],
    [hasDefaultHoldingsDataSource, holdingsDataSourceRows],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(buildManagedAccountInitialValues());
    setValidationError(null);
  }, [open]);

  const optionsError =
    executionVenuesQuery.error || holdingsDataSourcesQuery.error;

  return (
    <Dialog
      title="Create account"
      description="Create a managed account record from the Markets account registry."
      open={open}
      onClose={() => {
        if (!isPending) {
          onClose();
        }
      }}
      className="max-w-[min(760px,calc(100vw-24px))]"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Account Name
            </label>
            <Input
              autoFocus
              value={values.accountName}
              onChange={(event) => {
                setValidationError(null);
                setValues((current) => ({
                  ...current,
                  accountName: event.target.value,
                }));
              }}
              placeholder="Alpha Rates Book"
            />
            <div className="text-xs text-muted-foreground">
              Account names must be unique.
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Execution Venue
            </label>
            <PickerField
              value={values.executionVenueUid}
              onChange={(value) => {
                setValidationError(null);
                setValues((current) => ({
                  ...current,
                  executionVenueUid: value,
                }));
              }}
              options={executionVenueOptions}
              placeholder="Choose an execution venue"
              searchPlaceholder="Search execution venues"
              emptyMessage="No matching execution venues."
              loading={executionVenuesQuery.isLoading}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Holdings Data Source
            </label>
            <PickerField
              value={values.holdingsDataSourceId}
              onChange={(value) => {
                setValues((current) => ({
                  ...current,
                  holdingsDataSourceId: value,
                }));
              }}
              options={holdingsDataSourceOptions}
              placeholder={
                hasDefaultHoldingsDataSource
                  ? "Use organization default"
                  : "Choose a holdings data source"
              }
              searchPlaceholder="Search data sources"
              emptyMessage="No matching data sources."
              loading={holdingsDataSourcesQuery.isLoading}
            />
            <div className="text-xs text-muted-foreground">
              {holdingsDataSourceRows.length === 0 && !holdingsDataSourcesQuery.isLoading
                ? "No holdings data sources are available. Configure one or define an organization default before creating this account."
                : hasDefaultHoldingsDataSource
                ? "Optional when the organization already has a default holdings data source."
                : "Required when the organization does not define a default holdings data source."}
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Paper Account
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: true, label: "Paper" },
                { value: false, label: "Live" },
              ] as const).map((option) => {
                const selected = values.isPaper === option.value;

                return (
                  <button
                    key={option.label}
                    type="button"
                    className={cn(
                      "flex h-11 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                      selected
                        ? "border-primary/55 bg-primary/12 text-foreground"
                        : "bg-background/35 text-muted-foreground hover:border-primary/35 hover:text-foreground",
                    )}
                    onClick={() => {
                      setValues((current) => ({
                        ...current,
                        isPaper: option.value,
                      }));
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {validationError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {validationError}
          </div>
        ) : null}

        {optionsError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(optionsError)}
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
              const accountName = values.accountName.trim();

              if (!accountName) {
                setValidationError("Account name is required.");
                return;
              }

              if (!values.executionVenueUid.trim()) {
                setValidationError("Execution venue is required.");
                return;
              }

              if (!hasDefaultHoldingsDataSource && holdingsDataSourceRows.length > 0 && !values.holdingsDataSourceId.trim()) {
                setValidationError("Holdings data source is required when no organization default exists.");
                return;
              }

              if (!hasDefaultHoldingsDataSource && holdingsDataSourceRows.length === 0) {
                setValidationError("No holdings data sources are available. Configure one or define an organization default first.");
                return;
              }

              onSubmit({
                ...values,
                accountName,
              });
            }}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create account
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
