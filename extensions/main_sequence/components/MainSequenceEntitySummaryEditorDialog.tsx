import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";

import {
  fetchSummaryEditOptions,
  formatMainSequenceError,
  submitSummaryEdit,
  type SummaryEditChoiceOption,
  type SummaryField,
  type SummaryStat,
} from "../api";
import { PickerField, type PickerOption } from "./PickerField";

type EditableSummaryItem = SummaryField | SummaryStat;

function isSupportedEditor(item: EditableSummaryItem) {
  return (
    item.edit?.enabled &&
    ["text", "textarea", "number", "toggle", "select", "picker"].includes(item.edit.editor)
  );
}

function toEditableString(
  value: string | number | boolean | Array<string | number> | null | undefined,
) {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(", ");
  }

  return String(value);
}

function getToggleSelection(item: EditableSummaryItem) {
  const edit = item.edit;

  if (!edit) {
    return "false";
  }

  if (typeof item.value === "boolean") {
    return item.value ? "true" : "false";
  }

  if (item.value === edit.trueValue || String(item.value ?? "") === String(edit.trueValue ?? "")) {
    return "true";
  }

  if (item.value === edit.trueLabel || String(item.value ?? "") === String(edit.trueLabel ?? "")) {
    return "true";
  }

  return "false";
}

function resolveSubmittedValue(
  item: EditableSummaryItem,
  formValue: string,
  options: SummaryEditChoiceOption[],
) {
  const edit = item.edit;

  if (!edit) {
    return Array.isArray(item.value) ? item.value.map((entry) => String(entry)).join(", ") : item.value;
  }

  if (edit.editor === "toggle") {
    return formValue === "true" ? (edit.trueValue ?? true) : (edit.falseValue ?? false);
  }

  if (edit.editor === "number") {
    const trimmed = formValue.trim();
    return trimmed ? Number(trimmed) : null;
  }

  if (edit.editor === "select" || edit.editor === "picker") {
    if (!formValue) {
      return null;
    }

    const selectedOption = options.find((option) => String(option.value) === formValue);
    return selectedOption?.value ?? formValue;
  }

  return formValue;
}

function getDefaultFormValue(item: EditableSummaryItem) {
  if (item.edit?.editor === "toggle") {
    return getToggleSelection(item);
  }

  return toEditableString(item.value);
}

export function MainSequenceEntitySummaryEditorDialog({
  item,
  onClose,
  onUpdated,
  open,
  title,
}: {
  item: EditableSummaryItem | null;
  onClose: () => void;
  onUpdated?: () => Promise<void> | void;
  open: boolean;
  title: string;
}) {
  const { toast } = useToast();
  const [formValue, setFormValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const edit = item?.edit;
  const choicesQuery = useQuery({
    queryKey: ["main_sequence", "summary-edit-options", item?.key, edit?.choices?.endpoint],
    queryFn: () => fetchSummaryEditOptions(edit!),
    enabled:
      open &&
      Boolean(edit?.choices) &&
      (edit?.editor === "select" || edit?.editor === "picker"),
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!open || !item) {
      setFormValue("");
      setValidationError(null);
      return;
    }

    setFormValue(getDefaultFormValue(item));
    setValidationError(null);
  }, [item, open]);

  const pickerOptions = useMemo<PickerOption[]>(
    () => {
      const options = (choicesQuery.data ?? []).map((option) => ({
        value: String(option.value),
        label: option.label,
        description: option.description,
      }));

      if (!edit?.required) {
        return [
          {
            value: "",
            label: "None",
            description: "Clear the current value.",
          },
          ...options,
        ];
      }

      return options;
    },
    [choicesQuery.data, edit?.required],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!item?.edit) {
        throw new Error("This property is not editable.");
      }

      const trimmedValue = item.edit.editor === "textarea" ? formValue : formValue.trim();

      if (item.edit.required && !trimmedValue) {
        throw new Error(`${item.label} is required.`);
      }

      return submitSummaryEdit(
        item.edit,
        resolveSubmittedValue(item, trimmedValue, choicesQuery.data ?? []),
      );
    },
    onSuccess: async () => {
      toast({
        variant: "success",
        title: `${item?.label ?? "Property"} updated`,
        description: `${title} was updated successfully.`,
      });
      await onUpdated?.();
      onClose();
    },
    onError: (error) => {
      const message = formatMainSequenceError(error);
      setValidationError(message);
      toast({
        variant: "error",
        title: `${item?.label ?? "Property"} update failed`,
        description: message,
      });
    },
  });

  if (!item || !edit || !isSupportedEditor(item)) {
    return null;
  }

  const pickerPlaceholder = edit.placeholder ?? `Select ${item.label.toLowerCase()}`;
  const toggleLabels = {
    true: edit.trueLabel ?? "Enabled",
    false: edit.falseLabel ?? "Disabled",
  };

  return (
    <Dialog
      title={`Edit ${item.label}`}
      open={open}
      onClose={() => {
        if (!saveMutation.isPending) {
          onClose();
        }
      }}
      className="max-w-[min(560px,calc(100vw-24px))]"
      description={edit.description ?? `Update ${item.label.toLowerCase()} for ${title}.`}
    >
      <div className="space-y-5">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <PencilLine className="h-4 w-4" />
          <span>{item.label}</span>
        </div>

        {edit.editor === "text" || edit.editor === "number" ? (
          <Input
            autoFocus
            type={edit.editor === "number" ? "number" : "text"}
            step={edit.editor === "number" ? "any" : undefined}
            value={formValue}
            onChange={(event) => {
              setValidationError(null);
              setFormValue(event.target.value);
            }}
            placeholder={edit.placeholder}
          />
        ) : null}

        {edit.editor === "textarea" ? (
          <Textarea
            autoFocus
            value={formValue}
            onChange={(event) => {
              setValidationError(null);
              setFormValue(event.target.value);
            }}
            placeholder={edit.placeholder}
          />
        ) : null}

        {edit.editor === "toggle" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(["true", "false"] as const).map((toggleValue) => {
              const selected = formValue === toggleValue;
              const label = toggleLabels[toggleValue];

              return (
                <button
                  key={toggleValue}
                  type="button"
                  className={
                    selected
                      ? "rounded-[calc(var(--radius)-6px)] border border-primary/40 bg-primary/12 px-4 py-3 text-left text-sm font-medium text-topbar-foreground"
                      : "rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  }
                  onClick={() => {
                    setValidationError(null);
                    setFormValue(toggleValue);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        {edit.editor === "select" || edit.editor === "picker" ? (
          <PickerField
            value={formValue}
            onChange={(value) => {
              setValidationError(null);
              setFormValue(value);
            }}
            options={pickerOptions}
            placeholder={pickerPlaceholder}
            searchPlaceholder={`Search ${item.label.toLowerCase()}`}
            emptyMessage={`No ${item.label.toLowerCase()} options available.`}
            loading={choicesQuery.isLoading}
            searchable={edit.editor === "picker"}
          />
        ) : null}

        {choicesQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(choicesQuery.error)}
          </div>
        ) : null}

        {validationError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {validationError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-white/8 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void saveMutation.mutateAsync();
            }}
            disabled={saveMutation.isPending || choicesQuery.isLoading}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PencilLine className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
