import { Waypoints } from "lucide-react";

import { MarkdownContent } from "@/components/ui/markdown-content";
import { Badge } from "@/components/ui/badge";
import {
  CORE_VALUE_STRING_CONTRACT,
} from "@/widgets/shared/value-contracts";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetComponentProps,
} from "@/widgets/types";

export const UPSTREAM_INSPECTOR_INPUT_ID = "value";

export type UpstreamInspectorDisplayMode = "markdown" | "raw";

export interface UpstreamInspectorWidgetProps extends Record<string, unknown> {
  content?: string;
  displayMode?: UpstreamInspectorDisplayMode;
  emptyState?: string;
}

const defaultEmptyState =
  "Bind an upstream widget output to inspect the resolved value here.";

function normalizeDisplayMode(
  value: UpstreamInspectorWidgetProps["displayMode"],
): UpstreamInspectorDisplayMode {
  return value === "raw" ? "raw" : "markdown";
}

function resolvePrimaryInput(
  value: ResolvedWidgetInput | ResolvedWidgetInput[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

function formatResolvedValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return JSON.stringify(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatBindingStatus(status: ResolvedWidgetInput["status"]) {
  switch (status) {
    case "contract-mismatch":
      return "Contract mismatch";
    case "missing-output":
      return "Missing output";
    case "missing-source":
      return "Missing source";
    case "self-reference-blocked":
      return "Self reference blocked";
    case "transform-invalid":
      return "Invalid transform";
    case "valid":
      return "Bound";
    case "unbound":
    default:
      return "Unbound";
  }
}

type Props = WidgetComponentProps<UpstreamInspectorWidgetProps>;

export function UpstreamInspectorWidget({
  props,
  resolvedInputs,
}: Props) {
  const displayMode = normalizeDisplayMode(props.displayMode);
  const emptyState = props.emptyState?.trim() || defaultEmptyState;
  const resolvedInput = resolvePrimaryInput(resolvedInputs?.[UPSTREAM_INSPECTOR_INPUT_ID]);
  const fallbackContent = props.content?.trim() ?? "";
  const boundContent =
    resolvedInput?.status === "valid" ? formatResolvedValue(resolvedInput.value) : "";
  const content = boundContent || fallbackContent;
  const bindingError =
    resolvedInput && resolvedInput.status !== "valid" && resolvedInput.status !== "unbound"
      ? formatBindingStatus(resolvedInput.status)
      : null;
  const shouldRenderMarkdown =
    displayMode === "markdown" &&
    (resolvedInput?.contractId === CORE_VALUE_STRING_CONTRACT || !resolvedInput);

  if (!content) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-5">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/28 px-5 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/65 text-muted-foreground">
            <Waypoints className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">No upstream value</div>
            <p className="text-sm text-muted-foreground">{bindingError ?? emptyState}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
        <Badge variant={resolvedInput?.status === "valid" ? "success" : "neutral"}>
          {resolvedInput?.status === "valid" ? "Bound" : "Manual"}
        </Badge>
        <Badge variant="neutral">{shouldRenderMarkdown ? "Markdown" : "Raw"}</Badge>
        {resolvedInput?.contractId ? (
          <Badge variant="neutral" className="font-mono text-[10px]">
            {resolvedInput.contractId}
          </Badge>
        ) : null}
        {resolvedInput?.sourceWidgetId ? (
          <div className="min-w-0 truncate text-xs text-muted-foreground">
            {resolvedInput.sourceWidgetId}
            {resolvedInput.sourceOutputId ? ` -> ${resolvedInput.sourceOutputId}` : ""}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {bindingError ? (
          <div className="mb-4 rounded-[calc(var(--radius)-6px)] border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger">
            {bindingError}
          </div>
        ) : null}

        {shouldRenderMarkdown ? (
          <div className="mx-auto max-w-3xl min-w-0">
            <MarkdownContent content={content} openLinksInNewTab />
          </div>
        ) : (
          <pre className="overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 p-4 font-mono text-xs leading-6 text-foreground whitespace-pre-wrap break-words">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
