import { useEffect, useState } from "react";

import { Loader2, Plus } from "lucide-react";

import { getAppPath } from "@/apps/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { formatMainSequenceError } from "../../../../common/api";
import type {
  CreatePortfolioGroupInput,
  PortfolioGroupListRow,
  PortfolioGroupRecord,
  TargetPortfolioSearchOption,
  UpdatePortfolioGroupInput,
} from "../../../../common/api";

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncateText(value: string, maxLength = 140) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function isBlankValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function readFirstPresentValue(
  portfolioGroup: PortfolioGroupListRow | PortfolioGroupRecord,
  keys: string[],
) {
  for (const key of keys) {
    if (!(key in portfolioGroup)) {
      continue;
    }

    const value = portfolioGroup[key];

    if (!isBlankValue(value)) {
      return value;
    }
  }

  return null;
}

export function getPortfolioGroupsListPath() {
  return getAppPath("main_sequence_markets", "portfolio-groups");
}

export function getPortfolioGroupDetailPath(portfolioGroupUid: string) {
  return `${getPortfolioGroupsListPath()}/${encodeURIComponent(portfolioGroupUid)}`;
}

export function getTargetPortfolioDetailPath(portfolioUid: string) {
  const searchParams = new URLSearchParams({
    msTargetPortfolioUid: portfolioUid,
    msTargetPortfolioTab: "detail",
  });

  return `${getAppPath("main_sequence_markets", "portfolios")}?${searchParams.toString()}`;
}

export function getPortfolioGroupTitle(
  portfolioGroup: PortfolioGroupListRow | PortfolioGroupRecord | null | undefined,
) {
  if (!portfolioGroup) {
    return "";
  }

  return (
    readTrimmedString(portfolioGroup.name) ||
    readTrimmedString(portfolioGroup.display_name) ||
    readTrimmedString(portfolioGroup.portfolio_group_name) ||
    readTrimmedString(portfolioGroup.unique_identifier) ||
    readTrimmedString(portfolioGroup.title) ||
    (portfolioGroup.uid ? `Portfolio Group ${portfolioGroup.uid}` : "Portfolio Group")
  );
}

export function getPortfolioGroupUniqueIdentifier(
  portfolioGroup: PortfolioGroupListRow | PortfolioGroupRecord | null | undefined,
) {
  if (!portfolioGroup) {
    return null;
  }

  return readTrimmedString(portfolioGroup.unique_identifier);
}

export function getPortfolioGroupDescription(
  portfolioGroup: PortfolioGroupListRow | PortfolioGroupRecord | null | undefined,
) {
  if (!portfolioGroup) {
    return null;
  }

  return readTrimmedString(portfolioGroup.description);
}

export function getPortfolioGroupCreationDate(
  portfolioGroup: PortfolioGroupListRow | PortfolioGroupRecord | null | undefined,
) {
  if (!portfolioGroup) {
    return null;
  }

  return readFirstPresentValue(portfolioGroup, [
    "creation_date",
    "creation_date_display",
    "created_at",
    "created_display",
    "created",
  ]);
}

export function formatPortfolioGroupValue(value: unknown, key?: string) {
  if (isBlankValue(value)) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : "—";
  }

  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (key && key.toLowerCase().includes("date")) {
      const parsed = Date.parse(trimmed);

      if (Number.isFinite(parsed)) {
        return new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(parsed));
      }
    }

    return truncateText(trimmed);
  }

  if (Array.isArray(value)) {
    const normalizedItems = value
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter((item) => item.length > 0);

    return normalizedItems.length > 0 ? truncateText(normalizedItems.join(", ")) : "—";
  }

  try {
    return truncateText(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function buildPortfolioGroupDeleteSummary(portfolioGroups: PortfolioGroupListRow[]) {
  if (portfolioGroups.length === 0) {
    return null;
  }

  const preview = portfolioGroups.slice(0, 5);

  return (
    <div className="space-y-2">
      {preview.map((portfolioGroup) => (
        <div key={portfolioGroup.uid} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {getPortfolioGroupTitle(portfolioGroup)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {getPortfolioGroupUniqueIdentifier(portfolioGroup) ||
                getPortfolioGroupDescription(portfolioGroup) ||
                "No additional identifier"}
            </div>
          </div>
          <Badge variant="neutral">{`UID ${portfolioGroup.uid}`}</Badge>
        </div>
      ))}
      {portfolioGroups.length > preview.length ? (
        <div className="text-xs text-muted-foreground">
          {`…and ${portfolioGroups.length - preview.length} more portfolio group${portfolioGroups.length - preview.length === 1 ? "" : "s"}.`}
        </div>
      ) : null}
    </div>
  );
}

export type PortfolioGroupEditorValues = {
  uniqueIdentifier: string;
  displayName: string;
  description: string;
  metadataJson: string;
};

function parsePortfolioGroupMetadataJson(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata JSON must be an object.");
  }

  return parsed as Record<string, unknown>;
}

export function buildCreatePortfolioGroupPayload(
  values: PortfolioGroupEditorValues,
): CreatePortfolioGroupInput {
  const payload: CreatePortfolioGroupInput = {
    unique_identifier: values.uniqueIdentifier.trim(),
    metadata_json: parsePortfolioGroupMetadataJson(values.metadataJson),
  };

  const displayName = values.displayName.trim();
  const description = values.description.trim();

  if (displayName) {
    payload.display_name = displayName;
  }

  if (description) {
    payload.description = description;
  }

  return payload;
}

export function buildUpdatePortfolioGroupPayload(
  values: PortfolioGroupEditorValues,
): UpdatePortfolioGroupInput {
  return {
    display_name: values.displayName.trim(),
    description: values.description.trim(),
    metadata_json: parsePortfolioGroupMetadataJson(values.metadataJson),
  };
}

export function getPortfolioSearchOptionLabel(option: TargetPortfolioSearchOption) {
  const portfolioName = readTrimmedString(option.unique_identifier);
  return portfolioName || `Portfolio ${option.uid}`;
}

export function PortfolioGroupEditorDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error,
  initialValues,
  mode = "create",
  title,
  description,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PortfolioGroupEditorValues) => void;
  isPending: boolean;
  error: unknown;
  initialValues: PortfolioGroupEditorValues;
  mode?: "create" | "edit";
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<PortfolioGroupEditorValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);
  const isEditMode = mode === "edit";

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(initialValues);
    setValidationError(null);
  }, [initialValues, open]);

  return (
    <Dialog
      title={title ?? (isEditMode ? "Edit portfolio group" : "Create portfolio group")}
      description={
        description ??
        (isEditMode
          ? "Update the mutable portfolio group metadata."
          : "Create a portfolio group and then manage member portfolios from the detail settings tab.")
      }
      open={open}
      onClose={() => {
        if (!isPending) {
          onClose();
        }
      }}
      className="max-w-[min(620px,calc(100vw-24px))]"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Unique identifier
          </label>
          <Input
            autoFocus
            disabled={isPending || isEditMode}
            value={values.uniqueIdentifier}
            onChange={(event) => {
              setValidationError(null);
              setValues((current) => ({
                ...current,
                uniqueIdentifier: event.target.value,
              }));
            }}
            placeholder="core-portfolios"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Display name
          </label>
          <Input
            value={values.displayName}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
            placeholder="Portfolio Group Name"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Description
          </label>
          <Textarea
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Optional description"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Metadata JSON
          </label>
          <Textarea
            value={values.metadataJson}
            onChange={(event) => {
              setValidationError(null);
              setValues((current) => ({
                ...current,
                metadataJson: event.target.value,
              }));
            }}
            placeholder="{}"
            rows={6}
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
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              const uniqueIdentifier = values.uniqueIdentifier.trim();

              if (!uniqueIdentifier) {
                setValidationError("Unique identifier is required.");
                return;
              }

              try {
                parsePortfolioGroupMetadataJson(values.metadataJson);
                onSubmit({
                  uniqueIdentifier,
                  displayName: values.displayName,
                  description: values.description,
                  metadataJson: values.metadataJson,
                });
              } catch (metadataError) {
                setValidationError(
                  metadataError instanceof Error
                    ? metadataError.message
                    : "Metadata JSON is invalid.",
                );
              }
            }}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditMode ? null : (
              <Plus className="h-4 w-4" />
            )}
            {submitLabel ?? (isEditMode ? "Save group" : "Create group")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
