import { useMemo, useState } from "react";

import { Braces, ChevronDown, Copy, Search, X } from "lucide-react";

import { useDashboardWidgetDependencies } from "@/dashboards/DashboardWidgetDependencies";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import { cn } from "@/lib/utils";

import {
  buildWorkspaceVariableExplorerModel,
  filterWorkspaceVariableExplorerEntries,
  type WorkspaceVariableExplorerEntry,
  type WorkspaceVariableExplorerModel,
} from "./workspace-variable-explorer-model";

function copyText(value: string) {
  if (!navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value);
}

function statusClassName(status: WorkspaceVariableExplorerEntry["status"]) {
  switch (status) {
    case "ready":
      return "border-success/30 bg-success/10 text-success";
    case "error":
      return "border-danger/30 bg-danger/10 text-danger";
    case "stale":
      return "border-warning/30 bg-warning/10 text-warning";
    case "waiting":
    default:
      return "border-primary/30 bg-primary/10 text-primary";
  }
}

function formatConsumerKind(kind: WorkspaceVariableExplorerEntry["consumers"][number]["targetKind"]) {
  switch (kind) {
    case "title":
      return "Title";
    case "prop":
      return "Prop";
    case "widget-input":
      return "Input";
    default:
      return kind;
  }
}

function matchesExpanded(expandedIds: ReadonlySet<string>, entryId: string) {
  return expandedIds.has(entryId);
}

function VariableSummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/72 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function VariableEntryCard({
  entry,
  expanded,
  onToggleExpanded,
}: {
  entry: WorkspaceVariableExplorerEntry;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/72">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/35"
        onClick={onToggleExpanded}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {entry.sourceWidgetTitle}
            </span>
            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {entry.sourceOutputId}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                statusClassName(entry.status),
              )}
            >
              {entry.statusLabel}
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            {entry.referenceToken}
          </div>
          <div className="mt-2 break-words text-xs text-foreground">
            {entry.valuePreview.text}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded ? "rotate-180" : undefined,
          )}
        />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border/70 px-3 py-3">
          <div className="grid gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Normalized id:</span>{" "}
              <span className="break-all font-mono">{entry.normalizedId}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Source:</span>{" "}
              <span className="font-mono">{entry.sourceWidgetId}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Transform:</span>{" "}
              <span className="font-mono">{entry.transformSignature}</span>
            </div>
            {entry.sourceContract ? (
              <div>
                <span className="font-medium text-foreground">Contract:</span>{" "}
                <span className="font-mono">{entry.sourceContract}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              onClick={() => copyText(entry.referenceToken)}
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy token</span>
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              onClick={() => copyText(entry.normalizedId)}
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy id</span>
            </button>
          </div>

          {entry.valuePreview.detailText ? (
            <pre className="max-h-52 overflow-auto rounded-xl border border-border/70 bg-background/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {entry.valuePreview.detailText}
            </pre>
          ) : null}

          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Consumers
            </div>
            <div className="mt-2 space-y-2">
              {entry.consumers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                  No consumers are attached to this variable.
                </div>
              ) : (
                entry.consumers.map((consumer) => (
                  <div
                    key={`${consumer.targetWidgetId}:${consumer.targetInputId}`}
                    className="rounded-xl border border-border/70 bg-background/55 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {consumer.targetWidgetTitle}
                      </span>
                      <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {formatConsumerKind(consumer.targetKind)}
                      </span>
                    </div>
                    <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                      {consumer.propPath?.length
                        ? consumer.propPath.join(".")
                        : consumer.targetInputId}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VariableSection({
  entries,
  emptyLabel,
  expandedIds,
  title,
  onToggleExpanded,
}: {
  entries: WorkspaceVariableExplorerEntry[];
  emptyLabel: string;
  expandedIds: ReadonlySet<string>;
  title: string;
  onToggleExpanded: (entryId: string) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
        <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
          {entries.length.toLocaleString()}
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        entries.map((entry) => (
          <VariableEntryCard
            key={entry.id}
            entry={entry}
            expanded={matchesExpanded(expandedIds, entry.id)}
            onToggleExpanded={() => onToggleExpanded(entry.id)}
          />
        ))
      )}
    </section>
  );
}

function filterExplorerModel(model: WorkspaceVariableExplorerModel, query: string) {
  return {
    ...model,
    currentVariables: filterWorkspaceVariableExplorerEntries(model.currentVariables, query),
    referencedVariables: filterWorkspaceVariableExplorerEntries(model.referencedVariables, query),
  };
}

export function WorkspaceVariableExplorerPanel({
  open,
  onClose,
  placementClassName,
  widgets,
}: {
  open: boolean;
  onClose: () => void;
  placementClassName?: string;
  widgets: DashboardWidgetInstance[];
}) {
  const dependencyModel = useDashboardWidgetDependencies();
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const explorerModel = useMemo(
    () =>
      buildWorkspaceVariableExplorerModel({
        dependencyModel,
        widgets,
      }),
    [dependencyModel, widgets],
  );
  const filteredModel = useMemo(
    () => filterExplorerModel(explorerModel, query),
    [explorerModel, query],
  );
  const totalVisibleEntries =
    filteredModel.currentVariables.length + filteredModel.referencedVariables.length;

  function toggleExpanded(entryId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }

      return next;
    });
  }

  return (
    <aside
      className={cn(
        "absolute z-40 flex w-[min(560px,calc(100vw-3rem))] flex-col overflow-hidden rounded-[24px] border border-border/80 bg-background/96 shadow-[var(--shadow-panel)] backdrop-blur-xl transition-[transform,opacity] duration-200",
        placementClassName ?? "right-4 top-4 bottom-4",
        open ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+24px)] opacity-0 pointer-events-none",
      )}
      aria-label="Variable Explorer"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Braces className="h-4 w-4 text-primary" />
              <span>Variable Explorer</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Inspect active workspace variables, waiting references, and consumers without changing
              the workspace runtime.
            </p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/82 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Close Variable Explorer"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            <VariableSummaryCard label="Current" value={explorerModel.currentVariables.length} />
            <VariableSummaryCard label="Referenced" value={explorerModel.referencedVariables.length} />
            <VariableSummaryCard label="Consumers" value={explorerModel.totalConsumers} />
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search variables, widgets, outputs, and consumers"
              className="h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 pr-3 pl-9 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-ring/30"
            />
          </label>

          {query.trim() && totalVisibleEntries === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
              No variables match this filter.
            </div>
          ) : null}

          <VariableSection
            title="Current variables"
            entries={filteredModel.currentVariables}
            emptyLabel="No referenced variable has a current value yet."
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
          />

          <VariableSection
            title="Referenced variables"
            entries={filteredModel.referencedVariables}
            emptyLabel="No saved widget binding or reference expression is waiting for a variable."
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
          />
        </div>
      </div>
    </aside>
  );
}
