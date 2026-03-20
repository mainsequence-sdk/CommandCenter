import { useEffect, useState } from "react";

import { Loader2, Plus } from "lucide-react";

import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  formatMainSequenceError,
  type AssetCategoryDetailField,
  type AssetCategoryDetailResponse,
  type AssetCategoryListRow,
  type CreateAssetCategoryInput,
  type EntitySummaryHeader,
  type UpdateAssetCategoryInput,
} from "../../../../common/api";

export type AssetCategoryEditorMode = "create" | "edit";

export type AssetCategoryEditorValues = {
  displayName: string;
  uniqueIdentifier: string;
  description: string;
  assetIdsText: string;
};

export function getAssetCategoriesListPath() {
  return getAppPath("main_sequence_markets", "asset-categories");
}

export function getAssetCategoryDetailPath(categoryId: number) {
  return `${getAssetCategoriesListPath()}/${categoryId}`;
}

export function formatCategoryValue(
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

export function formatAssetValue(value: string | null | undefined, fallback = "Not available") {
  return value?.trim() || fallback;
}

function findCategoryDetailField(
  detail: AssetCategoryDetailResponse | null | undefined,
  fieldName: string,
) {
  return detail?.details.find((field) => field.name === fieldName) ?? null;
}

export function readCategoryDetailString(
  detail: AssetCategoryDetailResponse | null | undefined,
  fieldName: string,
) {
  const value = findCategoryDetailField(detail, fieldName)?.value;

  return value === null || value === undefined ? "" : String(value);
}

export function readCategoryDetailNumber(
  detail: AssetCategoryDetailResponse | null | undefined,
  fieldName: string,
) {
  const value = findCategoryDetailField(detail, fieldName)?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildCategoryListRowFromDetail(
  detail: AssetCategoryDetailResponse,
): AssetCategoryListRow {
  return {
    id: detail.id,
    unique_identifier: detail.selected_category.sub_text,
    display_name: detail.selected_category.text || detail.title,
    description: readCategoryDetailString(detail, "description"),
    number_of_assets: readCategoryDetailNumber(detail, "number_of_assets"),
  };
}

export function buildCategorySummary(detail: AssetCategoryDetailResponse): EntitySummaryHeader {
  const title =
    detail.title.trim() ||
    detail.selected_category.text.trim() ||
    `Asset Category ${detail.id}`;
  const uniqueIdentifier = detail.selected_category.sub_text.trim();
  const description = readCategoryDetailString(detail, "description");
  const assetCount = readCategoryDetailNumber(detail, "number_of_assets");

  return {
    entity: {
      id: detail.id,
      type: "asset_category",
      title,
    },
    badges: [
      {
        key: "editability",
        label: detail.actions.can_edit ? "Editable" : "Read only",
        tone: detail.actions.can_edit ? "success" : "neutral",
      },
    ],
    inline_fields: [
      {
        key: "category_id",
        label: "ID",
        value: detail.id,
        kind: "code",
      },
      {
        key: "unique_identifier",
        label: "UID",
        value: uniqueIdentifier || "Generated from display name",
        kind: "code",
        icon: "fingerprint",
      },
    ],
    highlight_fields: description
      ? [
          {
            key: "description",
            label: "Description",
            value: description,
            kind: "text",
            icon: "boxes",
          },
        ]
      : [],
    stats: [
      {
        key: "number_of_assets",
        label: "Assets",
        display: String(assetCount),
        value: assetCount,
        kind: "number",
      },
    ],
  };
}

export function buildFallbackCategoryDetails(row: AssetCategoryListRow | null): AssetCategoryDetailField[] {
  if (!row) {
    return [];
  }

  return [
    {
      name: "unique_identifier",
      label: "Unique identifier",
      value_type: "text",
      value: row.unique_identifier,
    },
    {
      name: "display_name",
      label: "Display name",
      value_type: "text",
      value: row.display_name,
    },
    {
      name: "description",
      label: "Description",
      value_type: "text",
      value: row.description,
    },
    {
      name: "number_of_assets",
      label: "Number of assets",
      value_type: "number",
      value: row.number_of_assets,
    },
  ];
}

function parseAssetIdsInput(rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return [];
  }

  const tokens = trimmed
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const parsedIds = tokens.map((token) => {
    const parsed = Number(token);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("Asset ids must be positive integers separated by commas or spaces.");
    }

    return parsed;
  });

  return Array.from(new Set(parsedIds));
}

export function buildCreatePayload(values: AssetCategoryEditorValues): CreateAssetCategoryInput {
  const payload: CreateAssetCategoryInput = {
    display_name: values.displayName.trim(),
  };
  const description = values.description.trim();
  const uniqueIdentifier = values.uniqueIdentifier.trim();

  if (description) {
    payload.description = description;
  }

  if (uniqueIdentifier) {
    payload.unique_identifier = uniqueIdentifier;
  }

  if (values.assetIdsText.trim()) {
    payload.assets = parseAssetIdsInput(values.assetIdsText);
  }

  return payload;
}

export function buildUpdatePayload(values: AssetCategoryEditorValues): UpdateAssetCategoryInput {
  const payload: UpdateAssetCategoryInput = {
    display_name: values.displayName.trim(),
    description: values.description.trim(),
  };

  if (values.assetIdsText.trim()) {
    payload.assets = parseAssetIdsInput(values.assetIdsText);
  }

  return payload;
}

export function buildEditorInitialValues(
  detail: AssetCategoryDetailResponse | null,
  row?: AssetCategoryListRow | null,
): AssetCategoryEditorValues {
  return {
    displayName: readCategoryDetailString(detail, "display_name") || row?.display_name || "",
    uniqueIdentifier:
      readCategoryDetailString(detail, "unique_identifier") || row?.unique_identifier || "",
    description: readCategoryDetailString(detail, "description") || row?.description || "",
    assetIdsText: "",
  };
}

export function buildCategoryDeleteSummary(categories: AssetCategoryListRow[]) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {categories.slice(0, 5).map((category) => (
        <div key={category.id} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {formatCategoryValue(category.display_name, `Category ${category.id}`)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {[
                `UID ${formatCategoryValue(category.unique_identifier)}`,
                `${category.number_of_assets} assets`,
                category.description ? category.description : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">ID {category.id}</div>
        </div>
      ))}
      {categories.length > 5 ? (
        <div className="text-xs text-muted-foreground">
          {`${categories.length - 5} more selected categories`}
        </div>
      ) : null}
    </div>
  );
}

export function buildFilteredDeleteSummary({
  totalCount,
  searchValue,
  displayNameContainsValue,
  uniqueIdentifierContainsValue,
  descriptionContainsValue,
}: {
  totalCount: number;
  searchValue: string;
  displayNameContainsValue: string;
  uniqueIdentifierContainsValue: string;
  descriptionContainsValue: string;
}) {
  const activeFilters = [
    searchValue.trim() ? `search=${searchValue.trim()}` : null,
    displayNameContainsValue.trim()
      ? `display_name__contains=${displayNameContainsValue.trim()}`
      : null,
    uniqueIdentifierContainsValue.trim()
      ? `unique_identifier__contains=${uniqueIdentifierContainsValue.trim()}`
      : null,
    descriptionContainsValue.trim()
      ? `description__contains=${descriptionContainsValue.trim()}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground">
        {`This will delete ${totalCount} asset categor${totalCount === 1 ? "y" : "ies"} matching the current filters.`}
      </div>
      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="neutral">
              {filter}
            </Badge>
          ))}
        </div>
      ) : null}
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

export function AssetCategoryEditorDialog({
  mode,
  open,
  onClose,
  onSubmit,
  isPending,
  error,
  initialValues,
}: {
  mode: AssetCategoryEditorMode;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AssetCategoryEditorValues) => void;
  isPending: boolean;
  error: unknown;
  initialValues: AssetCategoryEditorValues;
}) {
  const [values, setValues] = useState<AssetCategoryEditorValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(initialValues);
    setValidationError(null);
  }, [initialValues, open]);

  const isEditMode = mode === "edit";
  const title = isEditMode ? "Edit asset category" : "Create asset category";
  const submitLabel = isEditMode ? "Save changes" : "Create category";

  return (
    <Dialog
      title={title}
      description={
        isEditMode
          ? "Update the category metadata. Leave the asset ids field blank to keep membership unchanged."
          : "Create a new asset category backed by the migrated DRF serializer."
      }
      open={open}
      onClose={() => {
        if (!isPending) {
          onClose();
        }
      }}
      className="max-w-[min(720px,calc(100vw-24px))]"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Display name
            </label>
            <Input
              autoFocus
              value={values.displayName}
              onChange={(event) => {
                setValidationError(null);
                setValues((current) => ({
                  ...current,
                  displayName: event.target.value,
                }));
              }}
              placeholder="Large Cap Equities"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Unique identifier
            </label>
            <Input
              value={values.uniqueIdentifier}
              onChange={(event) => {
                setValidationError(null);
                setValues((current) => ({
                  ...current,
                  uniqueIdentifier: event.target.value,
                }));
              }}
              placeholder="large_cap_equities"
              disabled={isEditMode}
            />
            <div className="text-xs text-muted-foreground">
              {isEditMode
                ? "Unique identifier is read-only after creation."
                : "Optional. Leave blank to let the backend generate one from the display name."}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Description
          </label>
          <Textarea
            value={values.description}
            onChange={(event) => {
              setValidationError(null);
              setValues((current) => ({
                ...current,
                description: event.target.value,
              }));
            }}
            placeholder="US large cap equity universe"
            className="min-h-28"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Asset ids
          </label>
          <Textarea
            value={values.assetIdsText}
            onChange={(event) => {
              setValidationError(null);
              setValues((current) => ({
                ...current,
                assetIdsText: event.target.value,
              }));
            }}
            placeholder="101, 102, 103"
            className="min-h-24 font-mono text-xs"
          />
          <div className="text-xs text-muted-foreground">
            {isEditMode
              ? "Optional replacement membership. Leave blank to keep the current assets unchanged."
              : "Optional comma- or whitespace-separated asset ids to assign during creation."}
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
          <Button type="button" variant="secondary" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!values.displayName.trim()) {
                setValidationError("Display name is required.");
                return;
              }

              onSubmit(values);
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
