import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Send, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { widgetTightFormDescriptionClass, widgetTightFormFieldClass, widgetTightFormInputClass, widgetTightFormInsetSectionClass, widgetTightFormLabelClass, widgetTightFormSectionClass, widgetTightFormSelectClass, widgetTightFormTitleClass } from "@/widgets/shared/form-density";
import type { WidgetComponentProps } from "@/widgets/types";

import { buildAppComponentOpenApiQueryKey, fetchAppComponentOpenApiDocument, submitAppComponentRequest } from "./appComponentApi";
import {
  buildAppComponentDocsUrl,
  buildAppComponentGeneratedForm,
  buildAppComponentOpenApiUrl,
  buildAppComponentRequest,
  extractAppComponentPublishedOutputs,
  formatAppComponentFieldLocation,
  formatAppComponentMethodLabel,
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentOperation,
  tryResolveAppComponentBaseUrl,
  type AppComponentGeneratedField,
  type AppComponentWidgetProps,
  type AppComponentWidgetRuntimeState,
} from "./appComponentModel";

type Props = WidgetComponentProps<AppComponentWidgetProps>;

function linkClassName(disabled = false) {
  return cn(
    "inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border bg-card/75 px-3 text-xs font-medium text-foreground transition-colors",
    disabled ? "pointer-events-none opacity-50" : "hover:bg-muted/55",
  );
}

function formatTimestamp(timestampMs?: number) {
  if (!timestampMs) {
    return "Not sent yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
}

function isMultilineField(field: AppComponentGeneratedField) {
  return field.kind === "json";
}

function renderResponseBody(value: unknown) {
  if (value === undefined) {
    return "No response yet.";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function resolveStatusBadgeVariant(status: AppComponentWidgetRuntimeState["status"]) {
  switch (status) {
    case "success":
      return "success";
    case "error":
      return "danger";
    case "submitting":
      return "warning";
    case "idle":
    default:
      return "neutral";
  }
}

function FieldEditor({
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
  if (field.kind === "enum") {
    return (
      <Select
        value={value}
        disabled={disabled}
        className={widgetTightFormSelectClass}
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
        className={widgetTightFormSelectClass}
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
        className="min-h-[156px] rounded-[calc(var(--radius)-7px)] bg-background/55 font-mono text-xs leading-6 shadow-none"
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
      className={widgetTightFormInputClass}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

function AppComponentPlaceholder({
  baseUrl,
  title,
  description,
}: {
  baseUrl?: string;
  title: string;
  description: string;
}) {
  const docsUrl = buildAppComponentDocsUrl(baseUrl);
  const openApiUrl = buildAppComponentOpenApiUrl(baseUrl);

  return (
    <div className="flex h-full min-h-0 items-center justify-center p-4 md:p-5">
      <div className="max-w-lg space-y-4 rounded-[calc(var(--radius)-4px)] border border-dashed border-border/70 bg-background/24 px-5 py-6 text-center">
        <div className="space-y-2">
          <div className="text-base font-semibold text-foreground">{title}</div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <a href={docsUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!docsUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            Swagger UI
          </a>
          <a href={openApiUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!openApiUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            OpenAPI JSON
          </a>
        </div>
      </div>
    </div>
  );
}

export function AppComponentWidget({
  props,
  runtimeState,
  onRuntimeStateChange,
}: Props) {
  const normalizedProps = useMemo(() => normalizeAppComponentProps(props), [props]);
  const normalizedRuntimeState = useMemo(
    () => normalizeAppComponentRuntimeState(runtimeState),
    [runtimeState],
  );
  const resolvedBaseUrl = useMemo(
    () => tryResolveAppComponentBaseUrl(normalizedProps.apiBaseUrl),
    [normalizedProps.apiBaseUrl],
  );
  const openApiQuery = useQuery({
    queryKey: buildAppComponentOpenApiQueryKey(
      resolvedBaseUrl,
      normalizedProps.authMode ?? "session-jwt",
    ),
    queryFn: () =>
      fetchAppComponentOpenApiDocument({
        baseUrl: resolvedBaseUrl ?? "",
        authMode: normalizedProps.authMode,
      }),
    enabled: resolvedBaseUrl !== null,
    staleTime: 300_000,
  });
  const resolvedOperation = useMemo(
    () =>
      openApiQuery.data
        ? resolveAppComponentOperation(
            openApiQuery.data,
            normalizedProps.method,
            normalizedProps.path,
          )
        : null,
    [normalizedProps.method, normalizedProps.path, openApiQuery.data],
  );
  const generatedForm = useMemo(
    () =>
      openApiQuery.data
        ? buildAppComponentGeneratedForm(
            openApiQuery.data,
            resolvedOperation,
            normalizedProps.requestBodyContentType,
          )
        : null,
    [normalizedProps.requestBodyContentType, openApiQuery.data, resolvedOperation],
  );
  const initialDraftValues = useMemo(
    () =>
      resolveAppComponentInitialDraftValues(
        generatedForm,
        normalizedRuntimeState,
        resolvedOperation?.record.key,
      ),
    [generatedForm, normalizedRuntimeState, resolvedOperation?.record.key],
  );
  const initialDraftValuesKey = useMemo(
    () => JSON.stringify(initialDraftValues),
    [initialDraftValues],
  );
  const [draftValues, setDraftValues] = useState<Record<string, string>>(initialDraftValues);
  const [localRuntimeState, setLocalRuntimeState] =
    useState<AppComponentWidgetRuntimeState>(normalizedRuntimeState);

  useEffect(() => {
    setDraftValues(initialDraftValues);
  }, [initialDraftValuesKey]);

  useEffect(() => {
    setLocalRuntimeState(normalizedRuntimeState);
  }, [runtimeState]);

  function commitRuntimeState(nextState: AppComponentWidgetRuntimeState) {
    setLocalRuntimeState(nextState);
    onRuntimeStateChange?.(nextState);
  }

  function updateDraftValue(fieldKey: string, nextValue: string) {
    setDraftValues((current) => {
      const nextDraftValues = {
        ...current,
        [fieldKey]: nextValue,
      };

      commitRuntimeState({
        ...localRuntimeState,
        operationKey: resolvedOperation?.record.key,
        draftValues: nextDraftValues,
      });

      return nextDraftValues;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const buildResult = buildAppComponentRequest(
      normalizedProps,
      resolvedOperation,
      generatedForm,
      draftValues,
    );

    if (!buildResult.request) {
      commitRuntimeState({
        ...localRuntimeState,
        operationKey: resolvedOperation?.record.key,
        draftValues,
        status: "error",
        error: buildResult.errors.join(" "),
      });
      return;
    }

    commitRuntimeState({
      ...localRuntimeState,
      operationKey: resolvedOperation?.record.key,
      draftValues,
      status: "submitting",
      error: undefined,
    });

    try {
      const response = await submitAppComponentRequest({
        authMode: normalizedProps.authMode,
        method: buildResult.request.method,
        url: buildResult.request.url,
        headers: buildResult.request.headers,
        body: buildResult.request.body,
      });

      commitRuntimeState({
        operationKey: resolvedOperation?.record.key,
        draftValues,
        status: response.ok ? "success" : "error",
        lastExecutedAtMs: Date.now(),
        lastRequestUrl: response.url,
        lastResponseStatus: response.status,
        lastResponseStatusText: response.statusText,
        lastResponseHeaders: response.headers,
        lastResponseBody: response.body,
        error:
          response.ok
            ? undefined
            : typeof response.body === "string"
              ? response.body
              : `Request failed with ${response.status}.`,
        publishedOutputs: response.ok
          ? extractAppComponentPublishedOutputs(response.body)
          : undefined,
      });
    } catch (error) {
      commitRuntimeState({
        ...localRuntimeState,
        operationKey: resolvedOperation?.record.key,
        draftValues,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "The request failed before the API returned a response.",
      });
    }
  }

  if (!resolvedBaseUrl) {
    return (
      <AppComponentPlaceholder
        baseUrl={normalizedProps.apiBaseUrl}
        title="Invalid API base URL"
        description="Open widget settings and enter a valid API base URL before trying to build a request form."
      />
    );
  }

  if (openApiQuery.isLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4 md:p-5">
        <div className="flex items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading OpenAPI schema…
        </div>
      </div>
    );
  }

  if (openApiQuery.isError) {
    return (
      <AppComponentPlaceholder
        baseUrl={normalizedProps.apiBaseUrl}
        title="Unable to load /openapi.json"
        description={
          openApiQuery.error instanceof Error
            ? openApiQuery.error.message
            : "The widget could not load the target OpenAPI document."
        }
      />
    );
  }

  if (!normalizedProps.method || !normalizedProps.path || !resolvedOperation || !generatedForm) {
    return (
      <AppComponentPlaceholder
        baseUrl={normalizedProps.apiBaseUrl}
        title="No operation selected"
        description="Open widget settings, explore the API, and bind this widget instance to one route before sending requests."
      />
    );
  }

  const docsUrl = buildAppComponentDocsUrl(normalizedProps.apiBaseUrl);
  const openApiUrl = buildAppComponentOpenApiUrl(normalizedProps.apiBaseUrl);

  return (
    <div className="h-full min-h-0 overflow-auto p-4 md:p-5">
      <div className="space-y-4">
        <section className={widgetTightFormSectionClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">
                  {formatAppComponentMethodLabel(resolvedOperation.record.method)}
                </Badge>
                <Badge variant="neutral">{resolvedOperation.record.path}</Badge>
                <Badge variant="neutral">
                  {normalizedProps.authMode === "none" ? "No auth" : "JWT"}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {resolvedOperation.record.summary}
                </div>
                {resolvedOperation.record.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {resolvedOperation.record.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 text-right">
              {normalizedProps.authMode !== "none" ? (
                <div className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Session JWT attached by default
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <a href={docsUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!docsUrl)}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Swagger UI
                </a>
                <a href={openApiUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!openApiUrl)}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  OpenAPI JSON
                </a>
              </div>
            </div>
          </div>
        </section>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {generatedForm.parameterFields.length > 0 ? (
            <section className={widgetTightFormSectionClass}>
              <div className="space-y-1">
                <div className={widgetTightFormTitleClass}>Request Parameters</div>
                <p className={widgetTightFormDescriptionClass}>
                  Path, query, and header inputs discovered from the selected OpenAPI operation.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {generatedForm.parameterFields.map((field) => (
                  <label key={field.key} className={widgetTightFormFieldClass}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={widgetTightFormLabelClass}>{field.label}</span>
                      <Badge variant="neutral" className="py-0.5">
                        {formatAppComponentFieldLocation(field.location)}
                      </Badge>
                      {field.required ? <Badge variant="warning" className="py-0.5">Required</Badge> : null}
                    </div>
                    {field.description ? (
                      <p className={widgetTightFormDescriptionClass}>{field.description}</p>
                    ) : null}
                    <FieldEditor
                      disabled={localRuntimeState.status === "submitting"}
                      field={field}
                      value={draftValues[field.key] ?? ""}
                      onChange={(nextValue) => {
                        updateDraftValue(field.key, nextValue);
                      }}
                    />
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          {generatedForm.bodyMode !== "none" ? (
            <section className={widgetTightFormSectionClass}>
              <div className="space-y-1">
                <div className={widgetTightFormTitleClass}>Request Body</div>
                <p className={widgetTightFormDescriptionClass}>
                  {generatedForm.unsupportedReason ??
                    "Generated from the operation requestBody schema."}
                </p>
              </div>

              {generatedForm.bodyMode === "generated" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {generatedForm.bodyFields.map((field) => (
                    <label key={field.key} className={widgetTightFormFieldClass}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={widgetTightFormLabelClass}>{field.label}</span>
                        <Badge variant="neutral" className="py-0.5">
                          Body
                        </Badge>
                        {field.required ? <Badge variant="warning" className="py-0.5">Required</Badge> : null}
                      </div>
                      {field.description ? (
                        <p className={widgetTightFormDescriptionClass}>{field.description}</p>
                      ) : null}
                      <FieldEditor
                        disabled={localRuntimeState.status === "submitting"}
                        field={field}
                        value={draftValues[field.key] ?? ""}
                        onChange={(nextValue) => {
                          updateDraftValue(field.key, nextValue);
                        }}
                      />
                    </label>
                  ))}
                </div>
              ) : generatedForm.bodyRawField ? (
                <div className={widgetTightFormInsetSectionClass}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">
                      {generatedForm.bodyContentType ?? "Raw body"}
                    </Badge>
                    {generatedForm.bodyRequired ? <Badge variant="warning">Required</Badge> : null}
                  </div>
                  {generatedForm.bodyRawField.description ? (
                    <p className={widgetTightFormDescriptionClass}>
                      {generatedForm.bodyRawField.description}
                    </p>
                  ) : null}
                  <FieldEditor
                    disabled={localRuntimeState.status === "submitting"}
                    field={generatedForm.bodyRawField}
                    value={draftValues[generatedForm.bodyRawField.key] ?? ""}
                    onChange={(nextValue) => {
                      updateDraftValue(generatedForm.bodyRawField!.key, nextValue);
                    }}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/65 bg-background/24 px-4 py-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={resolveStatusBadgeVariant(localRuntimeState.status)}>
                  {localRuntimeState.status ?? "idle"}
                </Badge>
                {localRuntimeState.lastResponseStatus ? (
                  <Badge variant="neutral">{localRuntimeState.lastResponseStatus}</Badge>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                Last request: {formatTimestamp(localRuntimeState.lastExecutedAtMs)}
              </div>
            </div>
            <Button type="submit" disabled={localRuntimeState.status === "submitting"}>
              {localRuntimeState.status === "submitting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send request
            </Button>
          </section>
        </form>

        <section className={widgetTightFormSectionClass}>
          <div className="space-y-1">
            <div className={widgetTightFormTitleClass}>Response</div>
            <p className={widgetTightFormDescriptionClass}>
              Latest request result and the normalized payload stored in widget runtime state.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className={widgetTightFormInsetSectionClass}>
              <div className={widgetTightFormLabelClass}>Request URL</div>
              <div className="break-all text-xs text-foreground">
                {localRuntimeState.lastRequestUrl ?? "No request sent yet."}
              </div>
              {localRuntimeState.error ? (
                <div className="rounded-[calc(var(--radius)-7px)] border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {localRuntimeState.error}
                </div>
              ) : null}
            </div>

            <div className={widgetTightFormInsetSectionClass}>
              <div className={widgetTightFormLabelClass}>Published Outputs</div>
              <pre className="max-h-[160px] overflow-auto rounded-[calc(var(--radius)-7px)] bg-background/45 p-3 font-mono text-[11px] leading-5 text-foreground">
                {renderResponseBody(localRuntimeState.publishedOutputs)}
              </pre>
            </div>
          </div>

          <pre className="max-h-[320px] overflow-auto rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/45 p-3 font-mono text-[11px] leading-5 text-foreground">
            {renderResponseBody(localRuntimeState.lastResponseBody)}
          </pre>
        </section>
      </div>
    </div>
  );
}
