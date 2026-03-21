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

export function getPortfolioGroupDetailPath(portfolioGroupId: number) {
  return `${getPortfolioGroupsListPath()}/${portfolioGroupId}`;
}

export function getTargetPortfolioDetailPath(portfolioId: number) {
  const searchParams = new URLSearchParams({
    msTargetPortfolioId: String(portfolioId),
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
    `Portfolio Group ${portfolioGroup.id}`
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
        <div key={portfolioGroup.id} className="flex items-start justify-between gap-3">
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
          <Badge variant="neutral">{`ID ${portfolioGroup.id}`}</Badge>
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
  source: string;
  description: string;
};

export function buildCreatePortfolioGroupPayload(
  values: PortfolioGroupEditorValues,
): CreatePortfolioGroupInput {
  const payload: CreatePortfolioGroupInput = {
    unique_identifier: values.uniqueIdentifier.trim(),
  };

  const displayName = values.displayName.trim();
  const source = values.source.trim();
  const description = values.description.trim();

  if (displayName) {
    payload.display_name = displayName;
  }

  if (source) {
    payload.source = source;
  }

  if (description) {
    payload.description = description;
  }

  return payload;
}

export function getPortfolioSearchOptionLabel(option: TargetPortfolioSearchOption) {
  const portfolioName = readTrimmedString(option.portfolio_name);
  return portfolioName || `Portfolio ${option.id}`;
}

export function PortfolioGroupEditorDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PortfolioGroupEditorValues) => void;
  isPending: boolean;
  error: unknown;
  initialValues: PortfolioGroupEditorValues;
}) {
  const [values, setValues] = useState<PortfolioGroupEditorValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(initialValues);
    setValidationError(null);
  }, [initialValues, open]);

  return (
    <Dialog
      title="Create portfolio group"
      description="Create a new portfolio group and then manage the member portfolios from the detail settings tab."
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
            value={values.uniqueIdentifier}
            onChange={(event) => {
              setValidationError(null);
              setValues((current) => ({
                ...current,
                uniqueIdentifier: event.target.value,
              }));
            }}
            placeholder="portfolio_group_uid"
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
            Source
          </label>
          <Input
            value={values.source}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                source: event.target.value,
              }))
            }
            placeholder="Main Sequence Markets"
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

              onSubmit({
                uniqueIdentifier,
                displayName: values.displayName,
                source: values.source,
                description: values.description,
              });
            }}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create group
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
