import type { ReactNode } from "react";

import { Loader2, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  widgetTightFormDescriptionClass,
  widgetTightFormInsetSectionClass,
  widgetTightFormLabelClass,
  widgetTightFormSectionClass,
  widgetTightFormTitleClass,
} from "@/widgets/shared/form-density";

import {
  AppComponentFormSections,
  type AppComponentFieldBindingDisplayState,
} from "./AppComponentFormSections";
import {
  type AppComponentGeneratedForm,
  type AppComponentWidgetProps,
} from "./appComponentModel";

function formatTimestamp(timestampMs?: number) {
  if (!timestampMs) {
    return "Not sent yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
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

function resolveStatusBadgeVariant(status: "idle" | "submitting" | "success" | "error") {
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

export interface AppComponentRequestTestState {
  error?: string;
  lastExecutedAtMs?: number;
  lastRequestUrl?: string;
  lastResponseBody?: unknown;
  lastResponseStatus?: number;
  publishedOutputs?: Record<string, unknown>;
  status: "idle" | "submitting" | "success" | "error";
}

export interface AppComponentRequestTestSectionProps {
  beforeResponse?: ReactNode;
  boundFieldKeys?: Set<string>;
  description?: string;
  disabled?: boolean;
  effectiveDraftValues: Record<string, string>;
  emptyMessage?: string;
  fieldBindingStates?: Record<string, AppComponentFieldBindingDisplayState | undefined>;
  form: AppComponentGeneratedForm | null;
  onSubmit: () => void | Promise<void>;
  onValueChange: (fieldKey: string, nextValue: string) => void;
  onValuePatch?: (patch: Record<string, string>) => void;
  requestProps: AppComponentWidgetProps;
  responsePreview?: ReactNode;
  showPublishedOutputs?: boolean;
  state: AppComponentRequestTestState;
  submitDisabled?: boolean;
  submitLabel?: string;
  title?: string;
}

export function AppComponentRequestTestSection({
  beforeResponse,
  boundFieldKeys,
  description,
  disabled = false,
  effectiveDraftValues,
  emptyMessage = "This operation does not define request inputs. You can still send a test request.",
  fieldBindingStates,
  form,
  onSubmit,
  onValueChange,
  onValuePatch,
  requestProps,
  responsePreview,
  showPublishedOutputs = true,
  state,
  submitDisabled = false,
  submitLabel = "Test request",
  title = "Test Request",
}: AppComponentRequestTestSectionProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <section className={widgetTightFormSectionClass}>
        <div className="space-y-1">
          <div className={widgetTightFormTitleClass}>{title}</div>
          {description ? (
            <p className={widgetTightFormDescriptionClass}>{description}</p>
          ) : null}
        </div>

        {form &&
        (form.parameterFields.length > 0 || form.bodyMode !== "none") ? (
          <AppComponentFormSections
            boundFieldKeys={boundFieldKeys}
            disabled={disabled}
            fieldBindingStates={fieldBindingStates}
            form={form}
            requestContext={{
              props: requestProps,
              submissionForm: form,
            }}
            values={effectiveDraftValues}
            onValueChange={onValueChange}
            onValuePatch={onValuePatch}
          />
        ) : (
          <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 px-3 py-3 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/65 bg-background/24 px-4 py-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={resolveStatusBadgeVariant(state.status)}>
                {state.status}
              </Badge>
              {state.lastResponseStatus ? (
                <Badge variant="neutral">{state.lastResponseStatus}</Badge>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              Last request: {formatTimestamp(state.lastExecutedAtMs)}
            </div>
          </div>
          <Button type="submit" disabled={submitDisabled}>
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitLabel}
          </Button>
        </section>

        <div className={`grid gap-3 ${showPublishedOutputs ? "md:grid-cols-2" : ""}`}>
          <div className={widgetTightFormInsetSectionClass}>
            <div className={widgetTightFormLabelClass}>Request URL</div>
            <div className="break-all text-xs text-foreground">
              {state.lastRequestUrl ?? "No request sent yet."}
            </div>
            {state.error ? (
              <div className="rounded-[calc(var(--radius)-7px)] border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">
                {state.error}
              </div>
            ) : null}
          </div>

          {showPublishedOutputs ? (
            <div className={widgetTightFormInsetSectionClass}>
              <div className={widgetTightFormLabelClass}>Published Outputs</div>
              <pre className="max-h-[160px] overflow-auto rounded-[calc(var(--radius)-7px)] bg-background/45 p-3 font-mono text-[11px] leading-5 text-foreground">
                {renderResponseBody(state.publishedOutputs)}
              </pre>
            </div>
          ) : null}
        </div>

        {beforeResponse}

        {responsePreview ? (
          <div className={widgetTightFormInsetSectionClass}>
            <div className={widgetTightFormLabelClass}>Response Preview</div>
            {responsePreview}
          </div>
        ) : null}

        <div className={widgetTightFormInsetSectionClass}>
          <div className={widgetTightFormLabelClass}>
            {responsePreview ? "Raw Response Body" : "Response Body"}
          </div>
          <pre className="max-h-[320px] overflow-auto rounded-[calc(var(--radius)-7px)] bg-background/45 p-3 font-mono text-[11px] leading-5 text-foreground">
            {renderResponseBody(state.lastResponseBody)}
          </pre>
        </div>
      </section>
    </form>
  );
}
