import { useEffect, useState } from "react";

import { Loader2, Plus } from "lucide-react";

import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import {
  formatMainSequenceError,
  type AssetTranslationTableDetailField,
  type AssetTranslationTableDetailResponse,
  type AssetTranslationTableListRow,
  type AssetTranslationTableRuleInput,
  type AssetTranslationTableRuleListRow,
  type CreateAssetTranslationTableInput,
  type UpdateAssetTranslationTableInput,
} from "../../../../common/api";

export type AssetTranslationTableEditorMode = "create" | "edit";

export type AssetTranslationTableEditorValues = {
  uniqueIdentifier: string;
};

export type AssetTranslationTableRuleEditorMode = "create" | "edit";

export type AssetTranslationTableRuleEditorValues = {
  securityType: string;
  securityMarketSector: string;
  marketsTimeSerieUniqueIdentifier: string;
  targetExchangeCode: string;
  defaultColumnName: string;
};

export function getAssetTranslationTablesListPath() {
  return getAppPath("main_sequence_markets", "asset-translation-tables");
}

export function getAssetTranslationTableDetailPath(tableId: number) {
  return `${getAssetTranslationTablesListPath()}/${tableId}`;
}

export function formatTranslationTableValue(
  value: string | number | boolean | null | undefined,
  fallback = "Not available",
) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  const normalized = String(value).trim();
  return normalized || fallback;
}

export function formatTranslationDateTime(
  value: string | null | undefined,
  fallback = "Not available",
) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function findTranslationTableDetailField(
  detail: AssetTranslationTableDetailResponse | null | undefined,
  fieldName: string,
) {
  return detail?.details.find((field) => field.name === fieldName) ?? null;
}

export function readTranslationTableDetailString(
  detail: AssetTranslationTableDetailResponse | null | undefined,
  fieldName: string,
) {
  const value = findTranslationTableDetailField(detail, fieldName)?.value;

  return value === null || value === undefined ? "" : String(value);
}

export function readTranslationTableDetailNumber(
  detail: AssetTranslationTableDetailResponse | null | undefined,
  fieldName: string,
) {
  const value = findTranslationTableDetailField(detail, fieldName)?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildTranslationTableListRowFromDetail(
  detail: AssetTranslationTableDetailResponse,
): AssetTranslationTableListRow {
  return {
    id: detail.id,
    unique_identifier:
      readTranslationTableDetailString(detail, "unique_identifier") || detail.selected_table.text,
    rules_number: readTranslationTableDetailNumber(detail, "rules_number"),
    creation_date: readTranslationTableDetailString(detail, "creation_date") || null,
  };
}

export function renderTranslationTableDetailValue(field: AssetTranslationTableDetailField) {
  if (field.value_type === "datetime") {
    return formatTranslationDateTime(
      typeof field.value === "string" ? field.value : null,
    );
  }

  return formatTranslationTableValue(
    typeof field.value === "string" ||
      typeof field.value === "number" ||
      typeof field.value === "boolean" ||
      field.value === null
      ? field.value
      : String(field.value),
  );
}

export function buildAssetTranslationTableCreatePayload(
  values: AssetTranslationTableEditorValues,
): CreateAssetTranslationTableInput {
  const uniqueIdentifier = values.uniqueIdentifier.trim();

  if (!uniqueIdentifier) {
    throw new Error("Unique identifier is required.");
  }

  return {
    unique_identifier: uniqueIdentifier,
  };
}

export function buildAssetTranslationTableUpdatePayload(
  values: AssetTranslationTableEditorValues,
): UpdateAssetTranslationTableInput {
  return buildAssetTranslationTableCreatePayload(values);
}

export function buildAssetTranslationTableInitialValues(
  detail: AssetTranslationTableDetailResponse | null,
  row?: AssetTranslationTableListRow | null,
): AssetTranslationTableEditorValues {
  return {
    uniqueIdentifier:
      readTranslationTableDetailString(detail, "unique_identifier") || row?.unique_identifier || "",
  };
}

export function buildAssetTranslationTableDeleteSummary(
  tables: AssetTranslationTableListRow[],
) {
  if (tables.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {tables.slice(0, 5).map((table) => (
        <div key={table.id} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {formatTranslationTableValue(table.unique_identifier, `Table ${table.id}`)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {[
                `${table.rules_number} rules`,
                formatTranslationDateTime(table.creation_date, ""),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">ID {table.id}</div>
        </div>
      ))}
      {tables.length > 5 ? (
        <div className="text-xs text-muted-foreground">
          {`${tables.length - 5} more selected tables`}
        </div>
      ) : null}
    </div>
  );
}

export function buildFilteredAssetTranslationTableDeleteSummary({
  totalCount,
  searchValue,
}: {
  totalCount: number;
  searchValue: string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground">
        {`This will delete ${totalCount} translation table${totalCount === 1 ? "" : "s"} matching the current search.`}
      </div>
      {searchValue.trim() ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{`search=${searchValue.trim()}`}</Badge>
        </div>
      ) : null}
    </div>
  );
}

export function buildAssetTranslationTableRuleInitialValues(
  rule?: AssetTranslationTableRuleListRow | null,
): AssetTranslationTableRuleEditorValues {
  return {
    securityType: rule?.security_type?.trim() || "",
    securityMarketSector: rule?.security_market_sector?.trim() || "",
    marketsTimeSerieUniqueIdentifier: rule?.markets_time_serie_unique_identifier?.trim() || "",
    targetExchangeCode: rule?.target_exchange_code?.trim() || "",
    defaultColumnName: rule?.default_column_name?.trim() || "close",
  };
}

export function buildAssetTranslationTableRulePayload(
  values: AssetTranslationTableRuleEditorValues,
): AssetTranslationTableRuleInput {
  const securityType = values.securityType.trim();
  const securityMarketSector = values.securityMarketSector.trim();
  const marketsTimeSerieUniqueIdentifier = values.marketsTimeSerieUniqueIdentifier.trim();
  const targetExchangeCode = values.targetExchangeCode.trim();
  const defaultColumnName = values.defaultColumnName.trim() || "close";

  if (!securityType && !securityMarketSector) {
    throw new Error("Provide at least one of security type or security market sector.");
  }

  if (!marketsTimeSerieUniqueIdentifier) {
    throw new Error("Markets time serie unique identifier is required.");
  }

  return {
    asset_filter: {
      ...(securityType ? { security_type: securityType } : {}),
      ...(securityMarketSector ? { security_market_sector: securityMarketSector } : {}),
    },
    markets_time_serie_unique_identifier: marketsTimeSerieUniqueIdentifier,
    target_exchange_code: targetExchangeCode || undefined,
    default_column_name: defaultColumnName,
  };
}

export function buildAssetTranslationTableRuleDeleteSummary(
  rule: AssetTranslationTableRuleListRow | null,
) {
  if (!rule) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="font-medium text-foreground">
        {formatTranslationTableValue(rule.markets_time_serie_unique_identifier, `Rule ${rule.id}`)}
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          rule.security_type ? `security_type=${rule.security_type}` : null,
          rule.security_market_sector
            ? `security_market_sector=${rule.security_market_sector}`
            : null,
          rule.target_exchange_code ? `exchange=${rule.target_exchange_code}` : null,
          rule.default_column_name ? `column=${rule.default_column_name}` : null,
        ]
          .filter(Boolean)
          .map((value) => (
            <Badge key={value} variant="neutral">
              {value}
            </Badge>
          ))}
      </div>
      <div className="text-xs text-muted-foreground">{`ID ${rule.id}`}</div>
    </div>
  );
}

export function resolveDeletedCount(result: unknown, fallback: number) {
  if (result && typeof result === "object" && "deleted_count" in result) {
    const deletedCount = Number((result as { deleted_count?: number }).deleted_count ?? fallback);

    return Number.isFinite(deletedCount) ? deletedCount : fallback;
  }

  return fallback;
}

export function AssetTranslationTableEditorDialog({
  mode,
  open,
  onClose,
  onSubmit,
  isPending,
  error,
  initialValues,
}: {
  mode: AssetTranslationTableEditorMode;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AssetTranslationTableEditorValues) => void;
  isPending: boolean;
  error: unknown;
  initialValues: AssetTranslationTableEditorValues;
}) {
  const [values, setValues] = useState<AssetTranslationTableEditorValues>(initialValues);
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
      title={isEditMode ? "Rename translation table" : "Create translation table"}
      description={
        isEditMode
          ? "Update the unique identifier for this translation table."
          : "Create a new asset translation table."
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
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Unique identifier
          </label>
          <Input
            autoFocus
            value={values.uniqueIdentifier}
            onChange={(event) => {
              setValidationError(null);
              setValues({
                uniqueIdentifier: event.target.value,
              });
            }}
            placeholder="valuation_translation_table"
          />
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
              const uniqueIdentifier = values.uniqueIdentifier.trim();

              if (!uniqueIdentifier) {
                setValidationError("Unique identifier is required.");
                return;
              }

              onSubmit({
                uniqueIdentifier,
              });
            }}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isEditMode ? "Save changes" : "Create table"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function AssetTranslationTableRuleEditorDialog({
  mode,
  open,
  onClose,
  onSubmit,
  isPending,
  error,
  initialValues,
}: {
  mode: AssetTranslationTableRuleEditorMode;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AssetTranslationTableRuleEditorValues) => void;
  isPending: boolean;
  error: unknown;
  initialValues: AssetTranslationTableRuleEditorValues;
}) {
  const [values, setValues] = useState<AssetTranslationTableRuleEditorValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(initialValues);
    setValidationError(null);
  }, [initialValues, open]);

  const isEditMode = mode === "edit";

  function updateValue<K extends keyof AssetTranslationTableRuleEditorValues>(
    key: K,
    value: AssetTranslationTableRuleEditorValues[K],
  ) {
    setValidationError(null);
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <Dialog
      title={isEditMode ? "Edit translation rule" : "Create translation rule"}
      description="Define the asset filter and the target translation output for this rule."
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
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Security type
            </label>
            <Input
              autoFocus
              value={values.securityType}
              onChange={(event) => updateValue("securityType", event.target.value)}
              placeholder="spot"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Security market sector
            </label>
            <Input
              value={values.securityMarketSector}
              onChange={(event) => updateValue("securityMarketSector", event.target.value)}
              placeholder="crypto"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Markets time serie unique identifier
            </label>
            <Input
              value={values.marketsTimeSerieUniqueIdentifier}
              onChange={(event) =>
                updateValue("marketsTimeSerieUniqueIdentifier", event.target.value)
              }
              placeholder="polygon_close"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Target exchange code
            </label>
            <Input
              value={values.targetExchangeCode}
              onChange={(event) => updateValue("targetExchangeCode", event.target.value)}
              placeholder="BINANCE"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Default column name
            </label>
            <Input
              value={values.defaultColumnName}
              onChange={(event) => updateValue("defaultColumnName", event.target.value)}
              placeholder="close"
            />
          </div>
        </div>

        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-xs text-muted-foreground">
          At least one of security type or security market sector is required. Default column name
          falls back to <span className="font-mono text-foreground">close</span>.
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
              try {
                const nextValues = {
                  ...values,
                  defaultColumnName: values.defaultColumnName.trim() || "close",
                };

                buildAssetTranslationTableRulePayload(nextValues);
                onSubmit(nextValues);
              } catch (caughtError) {
                setValidationError(
                  caughtError instanceof Error ? caughtError.message : "Rule validation failed.",
                );
              }
            }}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isEditMode ? "Save rule" : "Create rule"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
