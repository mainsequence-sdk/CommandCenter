import { useState, type ReactNode } from "react";

import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Calendar,
  Cloud,
  Code2,
  Fingerprint,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  Globe,
  Info,
  Link as LinkIcon,
  Package,
  PencilLine,
  PlaySquare,
  TimerReset,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { EntitySummaryHeader, SummaryField, SummaryStat } from "../api";
import { MainSequenceEntitySummaryEditorDialog } from "./MainSequenceEntitySummaryEditorDialog";

function truncateMiddle(value: string, maxLength = 56) {
  if (value.length <= maxLength) {
    return value;
  }

  const head = value.slice(0, Math.ceil(maxLength / 2) - 2);
  const tail = value.slice(-Math.floor(maxLength / 2) + 1);
  return `${head}...${tail}`;
}

function summaryToneToBadgeVariant(tone?: string) {
  switch (tone) {
    case "info":
      return "primary" as const;
    case "success":
      return "success" as const;
    case "warning":
      return "warning" as const;
    case "danger":
      return "danger" as const;
    case "primary":
      return "primary" as const;
    case "secondary":
      return "secondary" as const;
    default:
      return "neutral" as const;
  }
}

function summaryToneToTextClassName(tone?: string) {
  switch (tone) {
    case "info":
      return "text-primary";
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "danger":
      return "text-danger";
    case "primary":
      return "text-primary";
    default:
      return "text-foreground";
  }
}

const summaryFieldIconMap: Record<string, LucideIcon> = {
  "git-branch": GitBranch,
  "git-commit": GitCommitHorizontal,
  "git-fork": GitFork,
  boxes: Boxes,
  package: Package,
  "play-square": PlaySquare,
  "timer-reset": TimerReset,
  calendar: Calendar,
  timer: TimerReset,
  fingerprint: Fingerprint,
  cloud: Cloud,
  code: Code2,
  globe: Globe,
  link: LinkIcon,
  "warning-2": AlertTriangle,
};

function getSummaryFieldIcon(field: SummaryField) {
  return field.icon ? summaryFieldIconMap[field.icon] : undefined;
}

function getSummaryValue(value: SummaryField["value"] | SummaryStat["value"]) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(", ");
  }

  return String(value);
}

function isEditableItem(item: SummaryField | SummaryStat) {
  return (
    item.edit?.enabled &&
    ["text", "textarea", "number", "toggle", "select", "picker"].includes(item.edit.editor)
  );
}

function SummaryEditButton({
  item,
  onClick,
}: {
  item: SummaryField | SummaryStat;
  onClick: () => void;
}) {
  if (!isEditableItem(item)) {
    return null;
  }

  return (
    <button
      type="button"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary/35 hover:text-primary"
      aria-label={`Edit ${item.label}`}
      title={`Edit ${item.label}`}
      onClick={onClick}
    >
      <PencilLine className="h-3 w-3" />
    </button>
  );
}

function SummaryHighlightField({
  onEdit,
  field,
  onClick,
}: {
  field: SummaryField;
  onEdit?: () => void;
  onClick?: () => void;
}) {
  const Icon = getSummaryFieldIcon(field);
  const value = getSummaryValue(field.value);
  const valueClassName = field.tone ? summaryToneToTextClassName(field.tone) : "text-foreground";
  const buttonClassName = `${valueClassName} mt-1.5 inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary`;

  return (
    <div className="min-w-[148px] max-w-full flex-none rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-[var(--summary-highlight-card-padding-x)] py-[var(--summary-highlight-card-padding-y)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          <span>{field.label}</span>
          {field.info ? (
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 text-[10px] text-muted-foreground"
              title={field.info}
            >
              <Info className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </div>
        <SummaryEditButton item={field} onClick={onEdit ?? (() => undefined)} />
      </div>

      {field.kind === "badges" && Array.isArray(field.value) ? (
        <div className="mt-[var(--summary-highlight-value-margin-top)] flex flex-wrap gap-1.5">
          {field.value.length > 0 ? (
            field.value.map((badgeValue, index) => (
              <Badge key={`${field.key}-${index}`} variant={summaryToneToBadgeVariant(field.tone)}>
                {String(badgeValue)}
              </Badge>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Not available</div>
          )}
        </div>
      ) : onClick ? (
        <button type="button" className={buttonClassName} onClick={onClick} title={field.meta || value}>
          <span className="truncate">{value}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div
          className={`${valueClassName} mt-[var(--summary-highlight-value-margin-top)] truncate text-sm font-medium`}
        >
          {value}
        </div>
      )}

      {field.meta ? (
        <div className="mt-[var(--summary-highlight-meta-margin-top)] truncate text-xs text-muted-foreground">
          {field.meta}
        </div>
      ) : null}
    </div>
  );
}

export function MainSequenceEntitySummaryCard({
  actions,
  onFieldLinkClick,
  onSummaryUpdated,
  summary,
}: {
  actions?: ReactNode;
  onFieldLinkClick?: (field: SummaryField) => void;
  onSummaryUpdated?: () => Promise<void> | void;
  summary: EntitySummaryHeader;
}) {
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const editableItems = [...summary.inline_fields, ...summary.highlight_fields, ...summary.stats];
  const editingItem =
    editableItems.find((item) => isEditableItem(item) && item.key === editingItemKey) ?? null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">{summary.entity.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {summary.inline_fields.map((field) => {
                  const Icon = getSummaryFieldIcon(field);
                  const fieldValue = getSummaryValue(field.value);
                  const showLabel = !Icon || field.kind === "code";
                  const isClickable = Boolean(field.href && onFieldLinkClick);
                  const valueClassName =
                    field.kind === "code"
                      ? "truncate font-mono text-[11px] text-foreground/90"
                      : `truncate ${field.tone ? summaryToneToTextClassName(field.tone) : "text-foreground/90"}`;

                  return (
                    <div
                      key={field.key}
                      className="inline-flex min-w-0 max-w-[460px] items-center gap-1.5"
                      title={field.meta || fieldValue}
                    >
                      {isClickable ? (
                        <button
                          type="button"
                          className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
                          onClick={() => onFieldLinkClick?.(field)}
                        >
                          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                          {showLabel ? <span>{field.label}</span> : null}
                          <span className={valueClassName}>
                            {field.kind === "code" ? truncateMiddle(fieldValue, 44) : fieldValue}
                          </span>
                        </button>
                      ) : (
                        <>
                          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                          {showLabel ? <span>{field.label}</span> : null}
                          <span className={valueClassName}>
                            {field.kind === "code" ? truncateMiddle(fieldValue, 44) : fieldValue}
                          </span>
                        </>
                      )}
                      <SummaryEditButton
                        item={field}
                        onClick={() => setEditingItemKey(field.key)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 xl:items-end">
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
              <div className="flex flex-wrap items-center gap-2">
                {summary.badges.map((badge) => (
                  <Badge key={badge.key} variant={summaryToneToBadgeVariant(badge.tone)}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {summary.highlight_fields.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-[var(--summary-highlight-gap)]">
              {summary.highlight_fields.map((field) => (
                <SummaryHighlightField
                  key={field.key}
                  field={field}
                  onClick={field.href && onFieldLinkClick ? () => onFieldLinkClick(field) : undefined}
                  onEdit={isEditableItem(field) ? () => setEditingItemKey(field.key) : undefined}
                />
              ))}
            </div>
          ) : null}
        </CardHeader>

        {summary.stats.length > 0 ? (
          <CardContent className="pt-4">
            <div className="mt-4">
              <div className="grid gap-[var(--summary-stat-grid-gap)] md:grid-cols-2 xl:grid-cols-4">
                {summary.stats.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-[var(--summary-stat-card-padding-x)] py-[var(--summary-stat-card-padding-y)]"
                  >
                    <div
                      className="flex items-center justify-between gap-3 uppercase tracking-[0.16em] text-muted-foreground"
                      style={{ fontSize: "var(--summary-stat-label-size)" }}
                    >
                      <span>{item.label}</span>
                      <SummaryEditButton
                        item={item}
                        onClick={() => setEditingItemKey(item.key)}
                      />
                    </div>
                    <div
                      className={cn(
                        "mt-[var(--summary-stat-value-margin-top)] font-semibold tracking-tight text-foreground",
                        item.edit?.enabled &&
                          item.edit.editor === "toggle" &&
                          item.value === true &&
                          "text-warning",
                      )}
                      style={{ fontSize: "var(--summary-stat-value-size)" }}
                    >
                      {item.display}
                    </div>
                    {item.info ? (
                      <div
                        className="mt-[var(--summary-stat-info-margin-top)] text-muted-foreground"
                        style={{
                          fontSize: "var(--summary-stat-info-size)",
                          lineHeight: "var(--line-height-body)",
                        }}
                      >
                        {item.info}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <MainSequenceEntitySummaryEditorDialog
        item={editingItem}
        open={Boolean(editingItem)}
        onClose={() => setEditingItemKey(null)}
        onUpdated={onSummaryUpdated}
        title={summary.entity.title}
      />
    </>
  );
}
