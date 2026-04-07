import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

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
  buildAppComponentConfiguredHeadersKey,
  buildAppComponentRequest,
  buildAppComponentEditableFormGeneratedField,
  listAppComponentRenderableBodyFields,
  listAppComponentRenderableParameterFields,
  resolveAppComponentResponseValueAtPath,
  type AppComponentEditableFormFieldDefinition,
  type AppComponentEditableFormSession,
  type AppComponentGeneratedField,
  type AppComponentGeneratedForm,
  type AppComponentWidgetProps,
} from "./appComponentModel";
import { submitAppComponentRequest } from "./appComponentApi";

export interface AppComponentFieldBindingDisplayState {
  isBound: boolean;
  message?: string;
  sourceSummary?: string;
  status: string;
  statusVariant?: "neutral" | "warning" | "danger" | "success";
}

interface AppComponentFormRequestContext {
  props: AppComponentWidgetProps;
  submissionForm: AppComponentGeneratedForm | null;
}

interface AppComponentAsyncSelectOption {
  label: string;
  value: string;
}

function isMultilineField(field: AppComponentGeneratedField) {
  return field.kind === "json";
}

function isCompactWideField(field: AppComponentGeneratedField) {
  return isMultilineField(field);
}

function buildCompactGridStyle(columnCount: number): CSSProperties | undefined {
  if (columnCount <= 1) {
    return undefined;
  }

  return {
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
  };
}

function readAsyncSelectOptionField(
  value: unknown,
  path: string[],
) {
  if (path.length === 0) {
    return value;
  }

  return resolveAppComponentResponseValueAtPath(value, path);
}

function buildAsyncSelectLabel(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
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

function AsyncSelectSearchFieldEditor({
  disabled,
  field,
  requestContext,
  title,
  value,
  values,
  onChange,
  onValuePatch,
}: {
  disabled: boolean;
  field: AppComponentGeneratedField;
  requestContext?: AppComponentFormRequestContext;
  title?: string;
  value: string;
  values: Record<string, string>;
  onChange: (nextValue: string) => void;
  onValuePatch?: (patch: Record<string, string>) => void;
}) {
  const enhancement =
    field.uiEnhancement?.widget === "select2" &&
    field.uiEnhancement.role === "async-select-search"
    ? field.uiEnhancement
    : undefined;
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [value]);

  const lookupValues = (() => {
    if (!enhancement) {
      return values;
    }

    const patch = Object.fromEntries(
      enhancement.searchFieldKeys.map((fieldKey) => [fieldKey, debouncedValue]),
    ) as Record<string, string>;

    if (enhancement.pageFieldKey) {
      patch[enhancement.pageFieldKey] = "1";
    }

    return {
      ...values,
      ...patch,
    };
  })();
  const lookupRequest = enhancement && requestContext?.submissionForm
    ? buildAppComponentRequest(
        requestContext.props,
        requestContext.submissionForm,
        lookupValues,
      )
    : undefined;
  const lookupQuery = useQuery({
    queryKey: [
      "app-component",
      "async-select-search",
      requestContext?.props.apiTargetMode ?? "manual",
      requestContext?.props.mainSequenceResourceRelease?.releaseId ?? "none",
      requestContext?.props.apiBaseUrl ?? "invalid",
      requestContext?.props.method ?? "unknown",
      requestContext?.props.path ?? "unknown",
      field.key,
      debouncedValue,
      buildAppComponentConfiguredHeadersKey(requestContext?.props.serviceHeaders),
      JSON.stringify(lookupValues),
    ],
    queryFn: async () => {
      if (!enhancement || !lookupRequest?.request) {
        return {
          options: [] as AppComponentAsyncSelectOption[],
          hasMore: false,
        };
      }

      const response = await submitAppComponentRequest({
        transportProps: requestContext?.props ?? {},
        method: lookupRequest.request.method,
        url: lookupRequest.request.url,
        headers: lookupRequest.request.headers,
        body: lookupRequest.request.body,
        cache: {
          enabled: true,
        },
      });

      if (!response.ok) {
        throw new Error(
          typeof response.body === "string"
            ? response.body
            : `Search request failed with ${response.status}.`,
        );
      }

      const items = resolveAppComponentResponseValueAtPath(response.body, enhancement.itemsPath);
      const optionEntries = Array.isArray(items)
        ? items.flatMap((item) => {
            const optionLabel = buildAsyncSelectLabel(
              readAsyncSelectOptionField(item, enhancement.itemLabelFieldPath),
            );
            const optionValue = buildAsyncSelectLabel(
              readAsyncSelectOptionField(item, enhancement.itemValueFieldPath),
            );

            if (!optionLabel || !optionValue) {
              return [];
            }

            return [{
              label: optionLabel,
              value: optionValue,
            } satisfies AppComponentAsyncSelectOption];
          })
        : [];
      const paginationValue =
        enhancement.paginationPath && enhancement.paginationPath.length > 0
          ? resolveAppComponentResponseValueAtPath(response.body, enhancement.paginationPath)
          : undefined;
      const hasMore =
        enhancement.paginationMoreField &&
        paginationValue &&
        typeof paginationValue === "object" &&
        !Array.isArray(paginationValue) &&
        enhancement.paginationMoreField in paginationValue
          ? (paginationValue as Record<string, unknown>)[enhancement.paginationMoreField] === true
          : false;

      return {
        options: optionEntries,
        hasMore,
      };
    },
    enabled:
      disabled !== true &&
      Boolean(enhancement) &&
      Boolean(requestContext?.submissionForm) &&
      debouncedValue.trim().length > 0 &&
      Boolean(lookupRequest?.request),
    staleTime: 30_000,
  });

  const activeEnhancement = enhancement;

  if (!activeEnhancement) {
    return null;
  }

  function applySearchPatch(nextSearch: string) {
    const enhancementConfig = activeEnhancement;

    if (!enhancementConfig) {
      return;
    }

    const patch = Object.fromEntries(
      enhancementConfig.searchFieldKeys.map((fieldKey) => [fieldKey, nextSearch]),
    ) as Record<string, string>;

    if (enhancementConfig.pageFieldKey) {
      patch[enhancementConfig.pageFieldKey] = "1";
    }

    if (onValuePatch) {
      onValuePatch(patch);
      return;
    }

    onChange(nextSearch);
  }

  return (
    <div className="space-y-2">
      <Input
        value={value}
        readOnly={disabled}
        title={title}
        placeholder="Search and choose an option"
        className={widgetTightFormInputClass}
        onChange={(event) => {
          applySearchPatch(event.target.value);
        }}
      />

      {lookupRequest && lookupRequest.errors.length > 0 && value.trim().length > 0 ? (
        <div className="rounded-[calc(var(--radius)-7px)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {lookupRequest.errors.join(" ")}
        </div>
      ) : null}

      {lookupQuery.isFetching ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Searching…
        </div>
      ) : null}

      {lookupQuery.error instanceof Error ? (
        <div className="rounded-[calc(var(--radius)-7px)] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {lookupQuery.error.message}
        </div>
      ) : null}

      {lookupQuery.data?.options.length ? (
        <div className="max-h-56 overflow-auto rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/35">
          {lookupQuery.data.options.map((option) => (
            <button
              key={`${option.value}:${option.label}`}
              type="button"
              className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2 text-left text-sm text-foreground last:border-b-0 hover:bg-muted/40"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                applySearchPatch(option.label);
              }}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.value !== option.label ? (
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {option.value}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : value.trim().length > 0 && !lookupQuery.isFetching && !lookupQuery.error ? (
        <div className="text-xs text-muted-foreground">No matching options.</div>
      ) : null}

      {lookupQuery.data?.hasMore ? (
        <div className="text-xs text-muted-foreground">
          More results are available. Refine the search text to narrow the list.
        </div>
      ) : null}
    </div>
  );
}

export function AppComponentFieldEditor({
  compact = false,
  disabled,
  field,
  inputId,
  title,
  value,
  onChange,
  values,
  requestContext,
  onValuePatch,
}: {
  compact?: boolean;
  disabled: boolean;
  field: AppComponentGeneratedField;
  inputId?: string;
  title?: string;
  value: string;
  onChange: (nextValue: string) => void;
  values?: Record<string, string>;
  requestContext?: AppComponentFormRequestContext;
  onValuePatch?: (patch: Record<string, string>) => void;
}) {
  if (
    field.uiEnhancement?.widget === "select2" &&
    field.uiEnhancement?.role === "async-select-search" &&
    values &&
    requestContext
  ) {
    return (
      <AsyncSelectSearchFieldEditor
        disabled={disabled}
        field={field}
        requestContext={requestContext}
        title={title}
        value={value}
        values={values}
        onChange={onChange}
        onValuePatch={onValuePatch}
      />
    );
  }

  if (field.kind === "enum") {
    const optionEntries =
      field.optionEntries ?? (field.enumValues ?? []).map((entry) => ({
        value: entry,
        label: entry,
      }));

    return (
      <Select
        id={inputId}
        value={value}
        disabled={disabled}
        className={compact ? "h-8 rounded-[calc(var(--radius)-7px)] bg-background/55 px-2 text-xs shadow-none" : widgetTightFormSelectClass}
        title={title}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {!field.required ? <option value="">Not set</option> : null}
        {optionEntries.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </Select>
    );
  }

  if (field.kind === "boolean") {
    return (
      <Select
        id={inputId}
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
        id={inputId}
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
      id={inputId}
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
  bound,
  disabled,
  field,
  requestContext,
  style,
  value,
  values,
  onChange,
  onValuePatch,
}: {
  bound?: boolean;
  disabled: boolean;
  field: AppComponentGeneratedField;
  requestContext?: AppComponentFormRequestContext;
  style?: CSSProperties;
  value: string;
  values: Record<string, string>;
  onChange: (nextValue: string) => void;
  onValuePatch?: (patch: Record<string, string>) => void;
}) {
  const inputId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1.5" style={style}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
        <label htmlFor={inputId} className="min-w-0 truncate">
          {field.label}
        </label>
        {field.required ? <span className="text-danger">*</span> : null}
        {bound ? (
          <Badge variant="neutral" className="h-4 px-1.5 py-0 text-[9px] uppercase tracking-[0.12em]">
            Bound
          </Badge>
        ) : null}
        {field.description ? <FieldDescriptionHint description={field.description} /> : null}
      </div>
      <div className="min-w-0">
        <FieldEditor
          compact
          disabled={disabled}
          field={field}
          inputId={inputId}
          title={field.description}
          value={value}
          values={values}
          requestContext={requestContext}
          onChange={onChange}
          onValuePatch={onValuePatch}
        />
      </div>
    </div>
  );
}

function FieldEditor(props: ComponentProps<typeof AppComponentFieldEditor>) {
  return <AppComponentFieldEditor {...props} />;
}

function EditableFormField({
  disabled,
  field,
  session,
  onValueChange,
}: {
  disabled: boolean;
  field: AppComponentEditableFormFieldDefinition;
  session: AppComponentEditableFormSession;
  onValueChange: (token: string, nextValue: string) => void;
}) {
  const generatedField = buildAppComponentEditableFormGeneratedField(field);
  const inputId = useId();

  return (
    <label
      className={cn(
        widgetTightFormFieldClass,
        generatedField.kind === "json" ? "md:col-span-2" : undefined,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={widgetTightFormLabelClass}>{field.label}</span>
        {field.required ? (
          <Badge variant="warning" className="py-0.5">
            Required
          </Badge>
        ) : null}
        {field.editable !== true ? <Badge variant="neutral">Read only</Badge> : null}
      </div>
      {field.description ? (
        <p className={widgetTightFormDescriptionClass}>{field.description}</p>
      ) : null}
      <FieldEditor
        disabled={disabled || field.editable !== true}
        field={generatedField}
        inputId={inputId}
        title={field.description}
        value={session.valuesByToken[field.token] ?? ""}
        values={session.valuesByToken}
        onChange={(nextValue) => {
          onValueChange(field.token, nextValue);
        }}
      />
    </label>
  );
}

export function AppComponentEditableFormSections({
  disabled,
  session,
  onValueChange,
}: {
  disabled: boolean;
  session: AppComponentEditableFormSession;
  onValueChange: (token: string, nextValue: string) => void;
}) {
  return (
    <div className="space-y-4">
      {session.title || session.description ? (
        <section className={widgetTightFormSectionClass}>
          <div className="space-y-1">
            {session.title ? (
              <div className={widgetTightFormTitleClass}>{session.title}</div>
            ) : null}
            {session.description ? (
              <p className={widgetTightFormDescriptionClass}>{session.description}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {session.sections.map((section) => (
        <section key={section.id} className={widgetTightFormSectionClass}>
          <div className="space-y-1">
            <div className={widgetTightFormTitleClass}>{section.title}</div>
            {section.description ? (
              <p className={widgetTightFormDescriptionClass}>{section.description}</p>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {section.fields.map((field) => (
              <EditableFormField
                key={field.token}
                disabled={disabled}
                field={field}
                session={session}
                onValueChange={onValueChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AppComponentFormSections({
  boundFieldKeys,
  compactColumnCount = 1,
  disabled,
  fieldBindingStates,
  form,
  mode = "default",
  requestContext,
  values,
  onValueChange,
  onValuePatch,
}: {
  boundFieldKeys?: Set<string>;
  compactColumnCount?: 1 | 2 | 3;
  disabled: boolean;
  fieldBindingStates?: Record<string, AppComponentFieldBindingDisplayState | undefined>;
  form: AppComponentGeneratedForm;
  mode?: "default" | "compact";
  requestContext?: AppComponentFormRequestContext;
  values: Record<string, string>;
  onValueChange: (fieldKey: string, nextValue: string) => void;
  onValuePatch?: (patch: Record<string, string>) => void;
}) {
  if (mode === "compact") {
    const parameterFields = listAppComponentRenderableParameterFields(form);
    const bodyFields = listAppComponentRenderableBodyFields(form);
    const bodyRawField = form.bodyRawField?.hiddenFromForm === true ? undefined : form.bodyRawField;
    const compactGridStyle = buildCompactGridStyle(compactColumnCount);
    const resolveCompactFieldStyle = (field: AppComponentGeneratedField) =>
      compactColumnCount > 1 && isCompactWideField(field)
        ? ({ gridColumn: "1 / -1" } satisfies CSSProperties)
        : undefined;

    return (
      <div className="space-y-3">
        {parameterFields.length > 0 ? (
          <div className="space-y-2">
            <div
              className="grid items-start gap-2.5"
              style={compactGridStyle}
            >
            {parameterFields.map((field) => (
              <CompactField
                key={field.key}
                bound={fieldBindingStates?.[field.key]?.isBound ?? boundFieldKeys?.has(field.key)}
                disabled={
                  disabled ||
                  Boolean(fieldBindingStates?.[field.key]?.isBound ?? boundFieldKeys?.has(field.key))
                }
                field={field}
                requestContext={requestContext}
                style={resolveCompactFieldStyle(field)}
                value={values[field.key] ?? ""}
                values={values}
                onChange={(nextValue) => {
                  onValueChange(field.key, nextValue);
                }}
                onValuePatch={onValuePatch}
              />
            ))}
            </div>
          </div>
        ) : null}

        {form.bodyMode === "generated" && bodyFields.length > 0 ? (
          <div className="space-y-2">
            <div
              className="grid items-start gap-2.5"
              style={compactGridStyle}
            >
            {bodyFields.map((field) => (
              <CompactField
                key={field.key}
                bound={fieldBindingStates?.[field.key]?.isBound ?? boundFieldKeys?.has(field.key)}
                disabled={
                  disabled ||
                  Boolean(fieldBindingStates?.[field.key]?.isBound ?? boundFieldKeys?.has(field.key))
                }
                field={field}
                requestContext={requestContext}
                style={resolveCompactFieldStyle(field)}
                value={values[field.key] ?? ""}
                values={values}
                onChange={(nextValue) => {
                  onValueChange(field.key, nextValue);
                }}
                onValuePatch={onValuePatch}
              />
            ))}
            </div>
          </div>
        ) : null}

        {form.bodyMode === "raw" && bodyRawField ? (
          <CompactField
            bound={
              fieldBindingStates?.[bodyRawField.key]?.isBound ??
              boundFieldKeys?.has(bodyRawField.key)
            }
            disabled={
              disabled ||
              Boolean(
                fieldBindingStates?.[bodyRawField.key]?.isBound ??
                  boundFieldKeys?.has(bodyRawField.key),
              )
            }
            field={bodyRawField}
            requestContext={requestContext}
            style={
              compactColumnCount > 1
                ? ({ gridColumn: "1 / -1" } satisfies CSSProperties)
                : undefined
            }
            value={values[bodyRawField.key] ?? ""}
            values={values}
            onChange={(nextValue) => {
              onValueChange(bodyRawField.key, nextValue);
            }}
            onValuePatch={onValuePatch}
          />
        ) : null}
      </div>
    );
  }

  const parameterFields = listAppComponentRenderableParameterFields(form);
  const bodyFields = listAppComponentRenderableBodyFields(form);
  const bodyRawField = form.bodyRawField?.hiddenFromForm === true ? undefined : form.bodyRawField;

  return (
    <>
      {parameterFields.length > 0 ? (
        <section className={widgetTightFormSectionClass}>
          <div className="space-y-1">
            <div className={widgetTightFormTitleClass}>Request Parameters</div>
            <p className={widgetTightFormDescriptionClass}>
              Path, query, and header inputs discovered from the selected OpenAPI operation.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {parameterFields.map((field) => (
              <label key={field.key} className={widgetTightFormFieldClass}>
                {(() => {
                  const bindingState = fieldBindingStates?.[field.key];
                  const isBound = bindingState?.isBound ?? boundFieldKeys?.has(field.key);

                  return (
                    <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={widgetTightFormLabelClass}>{field.label}</span>
                  {isBound ? <Badge variant="neutral">Bound</Badge> : null}
                  {field.required ? (
                    <Badge variant="warning" className="py-0.5">
                      Required
                    </Badge>
                  ) : null}
                </div>
                {field.description ? (
                  <p className={widgetTightFormDescriptionClass}>{field.description}</p>
                ) : null}
                {bindingState?.isBound ? (
                  <div className="space-y-1 rounded-[calc(var(--radius)-7px)] border border-border/60 bg-background/22 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {bindingState.statusVariant ? (
                        <Badge variant={bindingState.statusVariant}>{bindingState.status}</Badge>
                      ) : null}
                      {bindingState.sourceSummary ? (
                        <span className="font-medium text-foreground">
                          {bindingState.sourceSummary}
                        </span>
                      ) : null}
                    </div>
                    {bindingState.message ? (
                      <div className="text-muted-foreground">{bindingState.message}</div>
                    ) : null}
                  </div>
                ) : null}
                <FieldEditor
                  disabled={disabled || Boolean(isBound)}
                  field={field}
                  title={field.description}
                  value={values[field.key] ?? ""}
                  values={values}
                  requestContext={requestContext}
                  onChange={(nextValue) => {
                    onValueChange(field.key, nextValue);
                  }}
                  onValuePatch={onValuePatch}
                />
                    </>
                  );
                })()}
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {form.bodyMode !== "none" && (bodyFields.length > 0 || bodyRawField) ? (
        <section className={widgetTightFormSectionClass}>
          <div className="space-y-1">
            <div className={widgetTightFormTitleClass}>Request Body</div>
            <p className={widgetTightFormDescriptionClass}>
              {form.unsupportedReason ?? "Generated from the operation requestBody schema."}
            </p>
          </div>

          {form.bodyMode === "generated" ? (
            <div className="grid gap-3 md:grid-cols-2">
              {bodyFields.map((field) => (
                <label key={field.key} className={widgetTightFormFieldClass}>
                  {(() => {
                    const bindingState = fieldBindingStates?.[field.key];
                    const isBound = bindingState?.isBound ?? boundFieldKeys?.has(field.key);

                    return (
                      <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={widgetTightFormLabelClass}>{field.label}</span>
                    {isBound ? <Badge variant="neutral">Bound</Badge> : null}
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
                  {bindingState?.isBound ? (
                    <div className="space-y-1 rounded-[calc(var(--radius)-7px)] border border-border/60 bg-background/22 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {bindingState.statusVariant ? (
                          <Badge variant={bindingState.statusVariant}>{bindingState.status}</Badge>
                        ) : null}
                        {bindingState.sourceSummary ? (
                          <span className="font-medium text-foreground">
                            {bindingState.sourceSummary}
                          </span>
                        ) : null}
                      </div>
                      {bindingState.message ? (
                        <div className="text-muted-foreground">{bindingState.message}</div>
                      ) : null}
                    </div>
                  ) : null}
                  <FieldEditor
                    disabled={disabled || Boolean(isBound)}
                    field={field}
                    title={field.description}
                    value={values[field.key] ?? ""}
                    values={values}
                    requestContext={requestContext}
                    onChange={(nextValue) => {
                      onValueChange(field.key, nextValue);
                    }}
                    onValuePatch={onValuePatch}
                  />
                      </>
                    );
                  })()}
                </label>
              ))}
            </div>
          ) : bodyRawField ? (
            <div className={widgetTightFormInsetSectionClass}>
              {(() => {
                const bindingState = fieldBindingStates?.[bodyRawField.key];
                const isBound =
                  bindingState?.isBound ?? boundFieldKeys?.has(bodyRawField.key);

                return (
                  <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{form.bodyContentType ?? "Raw body"}</Badge>
                {isBound ? <Badge variant="neutral">Bound</Badge> : null}
                {form.bodyRequired ? <Badge variant="warning">Required</Badge> : null}
              </div>
                {bodyRawField.description ? (
                <p className={widgetTightFormDescriptionClass}>
                  {bodyRawField.description}
                </p>
              ) : null}
              {bindingState?.isBound ? (
                <div className="space-y-1 rounded-[calc(var(--radius)-7px)] border border-border/60 bg-background/22 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {bindingState.statusVariant ? (
                      <Badge variant={bindingState.statusVariant}>{bindingState.status}</Badge>
                    ) : null}
                    {bindingState.sourceSummary ? (
                      <span className="font-medium text-foreground">
                        {bindingState.sourceSummary}
                      </span>
                    ) : null}
                  </div>
                  {bindingState.message ? (
                    <div className="text-muted-foreground">{bindingState.message}</div>
                  ) : null}
                </div>
              ) : null}
              <FieldEditor
                disabled={disabled || Boolean(isBound)}
                field={bodyRawField}
                title={bodyRawField.description}
                value={values[bodyRawField.key] ?? ""}
                values={values}
                requestContext={requestContext}
                onChange={(nextValue) => {
                  onValueChange(bodyRawField.key, nextValue);
                }}
                onValuePatch={onValuePatch}
              />
                  </>
                );
              })()}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
