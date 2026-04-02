import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  widgetTightFormDescriptionClass,
  widgetTightFormFieldClass,
  widgetTightFormInputClass,
  widgetTightFormInsetSectionClass,
  widgetTightFormLabelClass,
  widgetTightFormSectionClass,
  widgetTightFormSelectClass,
  widgetTightFormTitleClass,
} from "@/widgets/shared/form-density";

import {
  type AppComponentGeneratedField,
  type AppComponentGeneratedForm,
} from "./appComponentModel";

function isMultilineField(field: AppComponentGeneratedField) {
  return field.kind === "json";
}

function FieldDescriptionHint({ description }: { description: string }) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || typeof window === "undefined") {
      return;
    }

    function updateTooltipPosition() {
      const triggerBounds = triggerRef.current?.getBoundingClientRect();

      if (!triggerBounds) {
        return;
      }

      const tooltipWidth = Math.min(240, Math.max(180, window.innerWidth - 24));
      const left = Math.min(
        triggerBounds.right + 10,
        Math.max(12, window.innerWidth - tooltipWidth - 12),
      );
      const top = Math.min(
        Math.max(triggerBounds.top + triggerBounds.height / 2, 20),
        Math.max(20, window.innerHeight - 20),
      );

      setTooltipStyle({
        left,
        top,
        width: tooltipWidth,
      });
    }

    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={description}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/70 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        onPointerEnter={() => {
          setOpen(true);
        }}
        onPointerLeave={() => {
          setOpen(false);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        i
      </button>
      {open && tooltipStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[120] -translate-y-1/2 rounded-[calc(var(--radius)-6px)] border border-border/80 bg-popover px-2.5 py-2 text-left text-[11px] font-medium leading-4 text-popover-foreground shadow-[var(--shadow-panel)]"
              style={tooltipStyle}
            >
              {description}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function FieldEditor({
  compact = false,
  disabled,
  field,
  title,
  value,
  onChange,
}: {
  compact?: boolean;
  disabled: boolean;
  field: AppComponentGeneratedField;
  title?: string;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  if (field.kind === "enum") {
    return (
      <Select
        value={value}
        disabled={disabled}
        className={compact ? "h-8 rounded-[calc(var(--radius)-7px)] bg-background/55 px-2 text-xs shadow-none" : widgetTightFormSelectClass}
        title={title}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {!field.required ? <option value="">Not set</option> : null}
        {(field.enumValues ?? []).map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </Select>
    );
  }

  if (field.kind === "boolean") {
    return (
      <Select
        value={value}
        disabled={disabled}
        className={compact ? "h-8 rounded-[calc(var(--radius)-7px)] bg-background/55 px-2 text-xs shadow-none" : widgetTightFormSelectClass}
        title={title}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">Not set</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    );
  }

  if (isMultilineField(field)) {
    return (
      <Textarea
        value={value}
        readOnly={disabled}
        spellCheck={false}
        title={title}
        className={
          compact
            ? "min-h-[120px] rounded-[calc(var(--radius)-7px)] bg-background/55 px-2.5 py-2 font-mono text-xs leading-5 shadow-none"
            : "min-h-[156px] rounded-[calc(var(--radius)-7px)] bg-background/55 font-mono text-xs leading-6 shadow-none"
        }
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }

  return (
    <Input
      type={
        field.kind === "number" || field.kind === "integer"
          ? "number"
          : field.kind === "date"
            ? "date"
            : field.kind === "date-time"
              ? "datetime-local"
              : "text"
      }
      step={field.kind === "integer" ? "1" : field.kind === "number" ? "any" : undefined}
      value={value}
      readOnly={disabled}
      title={title}
      className={
        compact
          ? "h-8 rounded-[calc(var(--radius)-7px)] bg-background/55 px-2.5 py-1 text-xs shadow-none"
          : widgetTightFormInputClass
      }
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

function CompactField({
  disabled,
  field,
  value,
  onChange,
}: {
  disabled: boolean;
  field: AppComponentGeneratedField;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const multiline = isMultilineField(field);

  return (
    <label
      className={cn(
        "flex min-w-0 gap-2.5",
        multiline ? "items-start" : "items-center",
      )}
    >
      <div
        className={cn(
          "flex w-28 shrink-0 min-w-0 items-center gap-1.5 text-xs font-medium text-foreground",
          multiline ? "pt-2" : "",
        )}
      >
        <span className="truncate">{field.label}</span>
        {field.required ? <span className="text-danger">*</span> : null}
        {field.description ? <FieldDescriptionHint description={field.description} /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <FieldEditor
          compact
          disabled={disabled}
          field={field}
          title={field.description}
          value={value}
          onChange={onChange}
        />
      </div>
    </label>
  );
}

export function AppComponentFormSections({
  disabled,
  form,
  mode = "default",
  values,
  onValueChange,
}: {
  disabled: boolean;
  form: AppComponentGeneratedForm;
  mode?: "default" | "compact";
  values: Record<string, string>;
  onValueChange: (fieldKey: string, nextValue: string) => void;
}) {
  if (mode === "compact") {
    return (
      <div className="space-y-3">
        {form.parameterFields.length > 0 ? (
          <div className="space-y-2">
            {form.parameterFields.map((field) => (
              <CompactField
                key={field.key}
                disabled={disabled}
                field={field}
                value={values[field.key] ?? ""}
                onChange={(nextValue) => {
                  onValueChange(field.key, nextValue);
                }}
              />
            ))}
          </div>
        ) : null}

        {form.bodyMode === "generated" ? (
          <div className="space-y-2">
            {form.bodyFields.map((field) => (
              <CompactField
                key={field.key}
                disabled={disabled}
                field={field}
                value={values[field.key] ?? ""}
                onChange={(nextValue) => {
                  onValueChange(field.key, nextValue);
                }}
              />
            ))}
          </div>
        ) : null}

        {form.bodyMode === "raw" && form.bodyRawField ? (
          <CompactField
            disabled={disabled}
            field={form.bodyRawField}
            value={values[form.bodyRawField.key] ?? ""}
            onChange={(nextValue) => {
              onValueChange(form.bodyRawField!.key, nextValue);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      {form.parameterFields.length > 0 ? (
        <section className={widgetTightFormSectionClass}>
          <div className="space-y-1">
            <div className={widgetTightFormTitleClass}>Request Parameters</div>
            <p className={widgetTightFormDescriptionClass}>
              Path, query, and header inputs discovered from the selected OpenAPI operation.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {form.parameterFields.map((field) => (
              <label key={field.key} className={widgetTightFormFieldClass}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={widgetTightFormLabelClass}>{field.label}</span>
                  {field.required ? (
                    <Badge variant="warning" className="py-0.5">
                      Required
                    </Badge>
                  ) : null}
                </div>
                {field.description ? (
                  <p className={widgetTightFormDescriptionClass}>{field.description}</p>
                ) : null}
                <FieldEditor
                  disabled={disabled}
                  field={field}
                  title={field.description}
                  value={values[field.key] ?? ""}
                  onChange={(nextValue) => {
                    onValueChange(field.key, nextValue);
                  }}
                />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {form.bodyMode !== "none" ? (
        <section className={widgetTightFormSectionClass}>
          <div className="space-y-1">
            <div className={widgetTightFormTitleClass}>Request Body</div>
            <p className={widgetTightFormDescriptionClass}>
              {form.unsupportedReason ?? "Generated from the operation requestBody schema."}
            </p>
          </div>

          {form.bodyMode === "generated" ? (
            <div className="grid gap-3 md:grid-cols-2">
              {form.bodyFields.map((field) => (
                <label key={field.key} className={widgetTightFormFieldClass}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={widgetTightFormLabelClass}>{field.label}</span>
                    <Badge variant="neutral" className="py-0.5">
                      Body
                    </Badge>
                    {field.required ? (
                      <Badge variant="warning" className="py-0.5">
                        Required
                      </Badge>
                    ) : null}
                  </div>
                  {field.description ? (
                    <p className={widgetTightFormDescriptionClass}>{field.description}</p>
                  ) : null}
                  <FieldEditor
                    disabled={disabled}
                    field={field}
                    title={field.description}
                    value={values[field.key] ?? ""}
                    onChange={(nextValue) => {
                      onValueChange(field.key, nextValue);
                    }}
                  />
                </label>
              ))}
            </div>
          ) : form.bodyRawField ? (
            <div className={widgetTightFormInsetSectionClass}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{form.bodyContentType ?? "Raw body"}</Badge>
                {form.bodyRequired ? <Badge variant="warning">Required</Badge> : null}
              </div>
              {form.bodyRawField.description ? (
                <p className={widgetTightFormDescriptionClass}>
                  {form.bodyRawField.description}
                </p>
              ) : null}
              <FieldEditor
                disabled={disabled}
                field={form.bodyRawField}
                title={form.bodyRawField.description}
                value={values[form.bodyRawField.key] ?? ""}
                onChange={(nextValue) => {
                  onValueChange(form.bodyRawField!.key, nextValue);
                }}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
