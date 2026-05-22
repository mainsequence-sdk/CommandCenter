import { useMemo } from "react";

import { AlertTriangle, Database, Loader2, Shuffle } from "lucide-react";

import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { TabularPreviewTable } from "@/widgets/shared/tabular-preview-table";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  formatTabularTransformSummary,
  resolveTabularTransformOutput,
  resolveTabularTransformSourceConsumerState,
  type TabularTransformWidgetProps,
} from "./tabularTransformModel";

type Props = WidgetComponentProps<TabularTransformWidgetProps>;

function SourceStateNotice({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
        <Database className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export function TabularTransformWidget({
  props,
  runtimeState,
  resolvedInputs,
  instanceId,
  runtimeDataStore,
}: Props) {
  const sourceConsumerState = useMemo(
    () =>
      resolveTabularTransformSourceConsumerState(
        resolvedInputs,
        runtimeDataStore,
        runtimeState,
      ),
    [resolvedInputs, runtimeDataStore, runtimeState],
  );
  useResolveWidgetUpstream(instanceId, {
    enabled: sourceConsumerState.requiresUpstreamResolution,
  });
  const frame = useMemo(
    () =>
      resolveTabularTransformOutput({
        props,
        runtimeState,
        resolvedInputs,
        runtimeDataStore,
      }),
    [props, resolvedInputs, runtimeDataStore, runtimeState],
  );
  const status = frame?.status ?? "idle";
  const isLoading =
    sourceConsumerState.kind === "loading" || status === "loading";
  const errorMessage =
    sourceConsumerState.kind === "error"
      ? sourceConsumerState.error ?? frame?.error ?? "Transform failed."
      : status === "error"
        ? frame?.error ?? "Transform failed."
        : null;

  if (sourceConsumerState.kind === "unbound") {
    return (
      <SourceStateNotice
        title="Bind a source dataset"
        body="Open the Bindings tab and connect this transform to a canonical tabular source."
      />
    );
  }

  if (sourceConsumerState.kind === "missing-source") {
    return (
      <SourceStateNotice
        title="Bound source is missing"
        body="Rebind this transform because the saved source widget no longer exists in this workspace."
      />
    );
  }

  if (sourceConsumerState.kind === "missing-output") {
    return (
      <SourceStateNotice
        title="Bound output is missing"
        body="The selected source widget no longer publishes the output this transform expects."
      />
    );
  }

  if (sourceConsumerState.kind === "contract-mismatch") {
    return (
      <SourceStateNotice
        title="Incompatible bound dataset"
        body="Bind this transform to a canonical tabular frame before configuring the transform."
      />
    );
  }

  if (
    sourceConsumerState.kind === "self-reference-blocked" ||
    sourceConsumerState.kind === "transform-invalid"
  ) {
    return (
      <SourceStateNotice
        title="Source binding is invalid"
        body="Fix the binding before this transform can resolve and republish its dataset."
      />
    );
  }

  if (sourceConsumerState.kind === "awaiting-upstream") {
    return (
      <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Resolving upstream source</div>
          <p className="text-sm text-muted-foreground">
            Refreshing the bound source widget so this transform can publish its output dataset.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[160px] flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/50 text-muted-foreground">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : errorMessage ? (
            <AlertTriangle className="h-5 w-5 text-danger" />
          ) : (
            <Shuffle className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {formatTabularTransformSummary(props)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {isLoading
              ? "Refreshing transformed dataset"
              : status === "ready"
                ? frame.rows.length > 0
                  ? "Transformed dataset"
                  : "Transformed dataset is empty"
                : "Waiting for source dataset"}
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger">
          {errorMessage}
        </div>
      ) : (
        <TabularPreviewTable
          className="min-h-0 flex-1"
          columns={frame?.columns ?? []}
          rows={frame?.rows ?? []}
          emptyMessage={
            frame?.columns.length
              ? "No transformed rows are available for the current source and settings."
              : "No transformed columns are available for the current source and settings."
          }
          maxRows={50}
        />
      )}
    </div>
  );
}
