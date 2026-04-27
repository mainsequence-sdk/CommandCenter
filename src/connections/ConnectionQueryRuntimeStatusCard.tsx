import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from "lucide-react";

import {
  buildConnectionQuerySourceIdentityLabel,
  resolveConnectionQueryRuntimeSummary,
} from "@/connections/managedConnectionQuerySource";

import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

function resolveToneClasses(tone: "neutral" | "warning" | "success" | "danger") {
  switch (tone) {
    case "danger":
      return "border-danger/40 bg-danger/10 text-danger";
    case "warning":
      return "border-warning/35 bg-warning/10 text-warning";
    case "success":
      return "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
    default:
      return "border-border/70 bg-background/35 text-muted-foreground";
  }
}

function resolveStatusIcon(status: ReturnType<typeof resolveConnectionQueryRuntimeSummary>["status"]) {
  switch (status) {
    case "error":
      return <AlertTriangle className="h-4 w-4" />;
    case "loading":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "ready":
      return <CheckCircle2 className="h-4 w-4" />;
    default:
      return <Clock3 className="h-4 w-4" />;
  }
}

export interface ConnectionQueryRuntimeStatusCardProps {
  title: string;
  description?: string;
  runtimeState?: unknown;
  draftProps?: ConnectionQueryWidgetProps;
  sourceTitle?: string;
  emptyMessage?: string;
}

export function ConnectionQueryRuntimeStatusCard({
  title,
  description,
  runtimeState,
  draftProps,
  sourceTitle,
  emptyMessage,
}: ConnectionQueryRuntimeStatusCardProps) {
  const summary = resolveConnectionQueryRuntimeSummary(runtimeState);
  const sourceIdentity = draftProps
    ? buildConnectionQuerySourceIdentityLabel(draftProps)
    : "";
  const summaryDescription =
    summary.status === "missing" && emptyMessage ? emptyMessage : summary.description;

  return (
    <section className="space-y-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-topbar-foreground">{title}</div>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>

      <div
        className={[
          "rounded-[calc(var(--radius)-6px)] border px-3 py-3",
          resolveToneClasses(summary.tone),
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{resolveStatusIcon(summary.status)}</div>
          <div className="min-w-0 space-y-1">
            <div className="font-medium">{summary.title}</div>
            <div className="text-sm leading-relaxed">{summaryDescription}</div>
            {sourceTitle ? (
              <div className="pt-1 text-xs opacity-80">
                Source widget: <span className="font-medium">{sourceTitle}</span>
              </div>
            ) : null}
            {sourceIdentity ? (
              <code className="block break-all pt-1 text-[11px] opacity-80">
                {sourceIdentity}
              </code>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
