import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import {
  AlertTriangle,
  Boxes,
  Calendar,
  Cloud,
  Code2,
  Database,
  Fingerprint,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  Globe,
  HardDrive,
  Info,
  Link as LinkIcon,
  ListTree,
  Loader2,
  Package,
  PencilLine,
  Plus,
  PlaySquare,
  Server,
  Table2,
  TimerReset,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import {
  addSummaryLabel,
  canMutateSummaryLabels,
  formatMainSequenceError,
  getSummaryLabels,
  removeSummaryLabel,
  type SummaryBadge,
  type SummaryField,
  type SummaryResponse,
  type SummaryStat,
} from "../api";
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
  database: Database,
  globe: Globe,
  bucket: HardDrive,
  link: LinkIcon,
  server: Server,
  "folder-open": FolderOpen,
  folder: FolderOpen,
  table: Table2,
  collection: ListTree,
  "warning-2": AlertTriangle,
};

function getSummaryFieldIcon(field: SummaryField) {
  return field.icon ? summaryFieldIconMap[field.icon] : undefined;
}

type SummaryLinkedItem = SummaryBadge | SummaryField | SummaryStat;

function getSummaryItemLinkUrl(item: SummaryLinkedItem) {
  return typeof item.link_url === "string" && item.link_url.trim()
    ? item.link_url.trim()
    : null;
}

function getSummaryFieldHref(field: SummaryField) {
  return typeof field.href === "string" && field.href.trim() ? field.href.trim() : null;
}

function openSummaryUrlFallback(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return;
  }

  if (/^https?:\/\//.test(trimmedUrl)) {
    window.open(trimmedUrl, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.assign(trimmedUrl);
}

function handleClickableSummaryKeyDown(event: KeyboardEvent<HTMLElement>, onClick: () => void) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  onClick();
}

function SummaryFieldLead({
  field,
}: {
  field: SummaryField;
}) {
  if (field.image) {
    return (
      <img
        src={field.image}
        alt={field.image_alt ?? field.label}
        className="h-3.5 w-3.5 flex-none rounded-[2px] object-contain"
      />
    );
  }

  const Icon = getSummaryFieldIcon(field);

  return Icon ? <Icon className="h-3.5 w-3.5 flex-none" /> : null;
}

function getSummaryValue(value: SummaryField["value"] | SummaryStat["value"]) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry === null || entry === undefined || entry === "") {
          return "Not available";
        }

        if (typeof entry === "object") {
          try {
            return JSON.stringify(entry);
          } catch {
            return "[object]";
          }
        }

        return String(entry);
      })
      .join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
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
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
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
  const hasLead = Boolean(field.image || field.icon);
  const value = getSummaryValue(field.value);
  const valueClassName = field.tone ? summaryToneToTextClassName(field.tone) : "text-foreground";
  const isClickable = Boolean(onClick);

  return (
    <div
      className={cn(
        "min-w-[148px] max-w-full flex-none rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-[var(--summary-highlight-card-padding-x)] py-[var(--summary-highlight-card-padding-y)]",
        isClickable &&
          "cursor-pointer transition-colors hover:border-primary/35 hover:bg-background/36 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => handleClickableSummaryKeyDown(event, onClick) : undefined}
      title={field.meta || value}
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {hasLead ? <SummaryFieldLead field={field} /> : null}
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
    </div>
  );
}

export function MainSequenceEntitySummaryCard({
  actions,
  onFieldLinkClick,
  onSummaryItemLinkClick,
  onSummaryUpdated,
  summary,
}: {
  actions?: ReactNode;
  onFieldLinkClick?: (field: SummaryField) => void;
  onSummaryItemLinkClick?: (linkUrl: string, item: SummaryLinkedItem) => void;
  onSummaryUpdated?: () => Promise<void> | void;
  summary: SummaryResponse;
}) {
  const { toast } = useToast();
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const summaryLabels = getSummaryLabels(summary);
  const [localLabels, setLocalLabels] = useState<string[]>(summaryLabels);
  const [labelInputOpen, setLabelInputOpen] = useState(false);
  const [activeLabelMutation, setActiveLabelMutation] = useState<{
    action: "add" | "remove";
    label: string;
  } | null>(null);
  const editableItems = [...summary.inline_fields, ...summary.highlight_fields, ...summary.stats];
  const editingItem =
    editableItems.find((item) => isEditableItem(item) && item.key === editingItemKey) ?? null;
  const isLabelable = canMutateSummaryLabels(summary);
  const displayedLabels = useMemo(
    () =>
      Array.from(
        new Set(
          localLabels
            .map((label) => label.trim())
            .filter(Boolean),
        ),
      ),
    [localLabels],
  );

  useEffect(() => {
    setLocalLabels(summaryLabels);
  }, [summary.entity.id, summary.entity.type, summaryLabels]);

  useEffect(() => {
    setLabelInput("");
    setLabelInputOpen(false);
  }, [summary.entity.id, summary.entity.type]);

  async function refreshSummaryAfterLabelMutation(nextLabels: string[]) {
    setLocalLabels(nextLabels);

    if (onSummaryUpdated) {
      await onSummaryUpdated();
    }
  }

  async function handleAddLabel(rawLabel: string) {
    const nextLabel = rawLabel.trim();

    if (!nextLabel) {
      setLabelInput("");
      return;
    }

    if (displayedLabels.includes(nextLabel)) {
      setLabelInput("");
      return;
    }

    setActiveLabelMutation({ action: "add", label: nextLabel });

    try {
      await addSummaryLabel(summary, nextLabel);
      await refreshSummaryAfterLabelMutation([...displayedLabels, nextLabel]);
      setLabelInput("");
      setLabelInputOpen(false);
      toast({
        title: "Label added",
        description: `${nextLabel} was added to ${summary.entity.title}.`,
      });
    } catch (error) {
      toast({
        title: "Label update failed",
        description: formatMainSequenceError(error),
      });
    } finally {
      setActiveLabelMutation(null);
    }
  }

  async function handleRemoveLabel(labelToRemove: string) {
    setActiveLabelMutation({ action: "remove", label: labelToRemove });

    try {
      await removeSummaryLabel(summary, labelToRemove);
      await refreshSummaryAfterLabelMutation(
        displayedLabels.filter((label) => label !== labelToRemove),
      );
      toast({
        title: "Label removed",
        description: `${labelToRemove} was removed from ${summary.entity.title}.`,
      });
    } catch (error) {
      toast({
        title: "Label update failed",
        description: formatMainSequenceError(error),
      });
    } finally {
      setActiveLabelMutation(null);
    }
  }

  function handleLabelInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setLabelInput("");
      setLabelInputOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      void handleAddLabel(labelInput);
      return;
    }

    if (event.key === "Backspace" && !labelInput && displayedLabels.length > 0) {
      event.preventDefault();
      void handleRemoveLabel(displayedLabels[displayedLabels.length - 1]!);
    }
  }

  function handleSummaryItemLink(item: SummaryLinkedItem) {
    const linkUrl = getSummaryItemLinkUrl(item);

    if (!linkUrl) {
      return;
    }

    if (onSummaryItemLinkClick) {
      onSummaryItemLinkClick(linkUrl, item);
      return;
    }

    openSummaryUrlFallback(linkUrl);
  }

  function handleSummaryFieldClick(field: SummaryField) {
    const linkUrl = getSummaryItemLinkUrl(field);

    if (linkUrl) {
      handleSummaryItemLink(field);
      return;
    }

    const href = getSummaryFieldHref(field);

    if (!href) {
      return;
    }

    if (onFieldLinkClick) {
      onFieldLinkClick(field);
      return;
    }

    openSummaryUrlFallback(href);
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5 min-w-0">
              <CardTitle className="text-lg">{summary.entity.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {summary.inline_fields.map((field) => {
                  const hasLead = Boolean(field.image || field.icon);
                  const fieldValue = getSummaryValue(field.value);
                  const showLabel = !hasLead || field.kind === "code";
                  const isClickable = Boolean(
                    getSummaryItemLinkUrl(field) || getSummaryFieldHref(field),
                  );
                  const valueClassName =
                    field.kind === "code"
                      ? "truncate font-mono text-[11px] text-foreground/90"
                      : `truncate ${field.tone ? summaryToneToTextClassName(field.tone) : "text-foreground/90"}`;

                  return (
                    <div
                      key={field.key}
                      className="inline-flex min-w-0 max-w-full items-center gap-1.5"
                      title={field.meta || fieldValue}
                    >
                      {isClickable ? (
                        <button
                          type="button"
                          className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
                          onClick={() => handleSummaryFieldClick(field)}
                          title={field.meta || fieldValue}
                        >
                          {hasLead ? <SummaryFieldLead field={field} /> : null}
                          {showLabel ? <span>{field.label}</span> : null}
                          <span className={valueClassName} title={field.meta || fieldValue}>
                            {field.kind === "code" ? truncateMiddle(fieldValue, 44) : fieldValue}
                          </span>
                        </button>
                      ) : (
                        <>
                          {hasLead ? <SummaryFieldLead field={field} /> : null}
                          {showLabel ? <span>{field.label}</span> : null}
                          <span className={valueClassName} title={field.meta || fieldValue}>
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
            <div className="flex flex-col items-start gap-2">
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
              <div className="flex flex-wrap items-center gap-2">
                {summary.badges.map((badge) => {
                  const linkUrl = getSummaryItemLinkUrl(badge);
                  const badgeContent = (
                    <Badge variant={summaryToneToBadgeVariant(badge.tone)}>{badge.label}</Badge>
                  );

                  return linkUrl ? (
                    <button
                      key={badge.key}
                      type="button"
                      className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      title={linkUrl}
                      onClick={() => handleSummaryItemLink(badge)}
                    >
                      {badgeContent}
                    </button>
                  ) : (
                    <span key={badge.key}>{badgeContent}</span>
                  );
                })}
              </div>
              {isLabelable || displayedLabels.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <Tags className="h-3.5 w-3.5" />
                    <span>Labels</span>
                  </div>

                  {displayedLabels.map((label) => {
                    const isRemoving =
                      activeLabelMutation?.action === "remove" &&
                      activeLabelMutation.label === label;

                    return (
                      <Badge
                        key={label}
                        variant="neutral"
                        className="border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] text-foreground"
                      >
                        <span>{label}</span>
                        {isLabelable ? (
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Remove ${label} label`}
                            title={`Remove ${label} label`}
                            disabled={Boolean(activeLabelMutation)}
                            onClick={() => {
                              void handleRemoveLabel(label);
                            }}
                          >
                            {isRemoving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        ) : null}
                      </Badge>
                    );
                  })}

                  {isLabelable && labelInputOpen ? (
                    <div className="inline-flex h-8 min-w-[180px] max-w-[260px] items-center rounded-full border border-border/70 bg-background/24 px-3">
                      <input
                        autoFocus
                        value={labelInput}
                        onChange={(event) => {
                          setLabelInput(event.target.value);
                        }}
                        onKeyDown={handleLabelInputKeyDown}
                        onBlur={() => {
                          if (!labelInput.trim() && !activeLabelMutation) {
                            setLabelInputOpen(false);
                          }
                        }}
                        placeholder="Type a label"
                        disabled={Boolean(activeLabelMutation)}
                        className="h-full w-full border-0 bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  ) : null}

                  {isLabelable ? (
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/24 text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Add label"
                      title="Add label"
                      disabled={Boolean(activeLabelMutation)}
                      onClick={() => {
                        setLabelInputOpen((current) => !current);
                        if (labelInputOpen) {
                          setLabelInput("");
                        }
                      }}
                    >
                      {activeLabelMutation?.action === "add" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {summary.summary_warning ? (
            <div className="mt-3 flex items-start gap-2 rounded-[calc(var(--radius)-8px)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{summary.summary_warning}</span>
            </div>
          ) : null}

          {summary.highlight_fields.length > 0 ? (
            <div className="mt-3 grid gap-[var(--summary-highlight-gap)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
              {summary.highlight_fields.map((field) => (
                <SummaryHighlightField
                  key={field.key}
                  field={field}
                  onClick={
                    getSummaryItemLinkUrl(field) || getSummaryFieldHref(field)
                      ? () => handleSummaryFieldClick(field)
                      : undefined
                  }
                  onEdit={isEditableItem(field) ? () => setEditingItemKey(field.key) : undefined}
                />
              ))}
            </div>
          ) : null}
        </CardHeader>

        {summary.stats.length > 0 ? (
          <CardContent className="pt-4">
            <div className="mt-4">
              <div className="grid gap-[var(--summary-stat-grid-gap)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
                {summary.stats.map((item) => {
                  const linkUrl = getSummaryItemLinkUrl(item);

                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-[var(--summary-stat-card-padding-x)] py-[var(--summary-stat-card-padding-y)]",
                        linkUrl &&
                          "cursor-pointer transition-colors hover:border-primary/35 hover:bg-background/36 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                      )}
                      role={linkUrl ? "button" : undefined}
                      tabIndex={linkUrl ? 0 : undefined}
                      title={linkUrl ?? item.info ?? item.label}
                      onClick={linkUrl ? () => handleSummaryItemLink(item) : undefined}
                      onKeyDown={
                        linkUrl
                          ? (event) =>
                              handleClickableSummaryKeyDown(event, () =>
                                handleSummaryItemLink(item),
                              )
                          : undefined
                      }
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
                  );
                })}
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
