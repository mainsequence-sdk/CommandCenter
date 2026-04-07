import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  TabularFrameFieldProvenance,
  TabularFrameFieldSchema,
} from "@/widgets/shared/tabular-frame-source";

type FieldInspectorFilter = "all" | "warnings" | TabularFrameFieldProvenance;

function formatSampleValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getSampleValues(rows: Array<Record<string, unknown>>, key: string) {
  const seen = new Set<string>();
  const samples: string[] = [];

  for (const row of rows) {
    const sample = formatSampleValue(row[key]);

    if (!sample.trim() || sample === "—" || seen.has(sample)) {
      continue;
    }

    seen.add(sample);
    samples.push(sample);

    if (samples.length >= 4) {
      break;
    }
  }

  return samples;
}

function getProvenanceVariant(
  provenance: TabularFrameFieldProvenance | undefined,
): "primary" | "success" | "warning" | "neutral" {
  switch (provenance) {
    case "backend":
      return "primary";
    case "manual":
      return "success";
    case "derived":
      return "warning";
    default:
      return "neutral";
  }
}

function getProvenanceLabel(provenance: TabularFrameFieldProvenance | undefined) {
  switch (provenance) {
    case "backend":
      return "Backend";
    case "manual":
      return "Manual";
    case "derived":
      return "Derived";
    case "inferred":
      return "Inferred";
    default:
      return "Unspecified";
  }
}

function formatSummaryCount(value: number, label: string) {
  return `${value.toLocaleString()} ${label}`;
}

export function DataNodeFieldSchemaInspector({
  description = "Inspect the resolved field schema this widget is using.",
  emptyMessage = "No field schema is available yet.",
  fields,
  rows = [],
  title = "Field schema",
}: {
  description?: string;
  emptyMessage?: string;
  fields: TabularFrameFieldSchema[];
  rows?: Array<Record<string, unknown>>;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FieldInspectorFilter>("all");

  const normalizedFields = useMemo(
    () => fields.filter((field) => typeof field.key === "string" && field.key.trim()),
    [fields],
  );
  const summary = useMemo(() => {
    const counts = {
      backend: 0,
      manual: 0,
      inferred: 0,
      derived: 0,
      warnings: 0,
    };

    normalizedFields.forEach((field) => {
      if (field.provenance === "backend") {
        counts.backend += 1;
      } else if (field.provenance === "manual") {
        counts.manual += 1;
      } else if (field.provenance === "derived") {
        counts.derived += 1;
      } else {
        counts.inferred += 1;
      }

      if ((field.warnings?.length ?? 0) > 0) {
        counts.warnings += 1;
      }
    });

    return counts;
  }, [normalizedFields]);
  const sampleValuesByKey = useMemo(
    () =>
      new Map(
        normalizedFields.map((field) => [
          field.key,
          getSampleValues(rows, field.key),
        ] as const),
      ),
    [normalizedFields, rows],
  );
  const visibleFields = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return normalizedFields.filter((field) => {
      if (filter === "warnings" && (field.warnings?.length ?? 0) === 0) {
        return false;
      }

      if (
        filter !== "all" &&
        filter !== "warnings" &&
        (field.provenance ?? "inferred") !== filter
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        field.key,
        field.label ?? "",
        field.description ?? "",
        field.nativeType ?? "",
        field.type,
        field.reason ?? "",
        ...(field.derivedFrom ?? []),
        ...(field.warnings ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [filter, normalizedFields, query]);

  return (
    <>
      <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="text-sm font-medium text-topbar-foreground">{title}</div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">
                {formatSummaryCount(normalizedFields.length, "fields")}
              </Badge>
              {summary.backend > 0 ? (
                <Badge variant="primary">
                  {formatSummaryCount(summary.backend, "backend")}
                </Badge>
              ) : null}
              {summary.manual > 0 ? (
                <Badge variant="success">
                  {formatSummaryCount(summary.manual, "manual")}
                </Badge>
              ) : null}
              {summary.inferred > 0 ? (
                <Badge variant="neutral">
                  {formatSummaryCount(summary.inferred, "inferred")}
                </Badge>
              ) : null}
              {summary.derived > 0 ? (
                <Badge variant="warning">
                  {formatSummaryCount(summary.derived, "derived")}
                </Badge>
              ) : null}
              {summary.warnings > 0 ? (
                <Badge variant="danger">
                  {formatSummaryCount(summary.warnings, "warnings")}
                </Badge>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(true);
            }}
          >
            Inspect fields
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={title}
        description={description}
        contentClassName="space-y-4"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => {
              setFilter("all");
            }}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "warnings" ? "default" : "outline"}
            onClick={() => {
              setFilter("warnings");
            }}
          >
            Warnings
          </Button>
          {(["backend", "manual", "inferred", "derived"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => {
                setFilter(value);
              }}
            >
              {getProvenanceLabel(value)}
            </Button>
          ))}
        </div>

        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search field name, type, provenance, or warning"
        />

        {visibleFields.length === 0 ? (
          <div className="rounded-[calc(var(--radius)-8px)] border border-dashed border-border/70 bg-background/18 px-4 py-5 text-sm text-muted-foreground">
            {normalizedFields.length === 0 ? emptyMessage : "No fields match the current filter."}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleFields.map((field) => {
              const sampleValues = sampleValuesByKey.get(field.key) ?? [];

              return (
                <div
                  key={field.key}
                  className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/18 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-topbar-foreground">
                        {field.label?.trim() || field.key}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {field.key}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getProvenanceVariant(field.provenance)}>
                        {getProvenanceLabel(field.provenance)}
                      </Badge>
                      <Badge variant="secondary">{field.type}</Badge>
                      {field.nativeType ? (
                        <Badge variant="neutral">{field.nativeType}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        Resolved type
                      </div>
                      <div className="mt-1 text-foreground">{field.type}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        Native type
                      </div>
                      <div className="mt-1 text-foreground">{field.nativeType ?? "Not declared"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        Provenance
                      </div>
                      <div className="mt-1 text-foreground">{getProvenanceLabel(field.provenance)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        Derived from
                      </div>
                      <div className="mt-1 text-foreground">
                        {field.derivedFrom?.length ? field.derivedFrom.join(", ") : "—"}
                      </div>
                    </div>
                  </div>

                  {field.reason ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        Reason
                      </div>
                      <p className="text-sm text-foreground">{field.reason}</p>
                    </div>
                  ) : null}

                  {field.description ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        Description
                      </div>
                      <p className="text-sm text-foreground">{field.description}</p>
                    </div>
                  ) : null}

                  {sampleValues.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        Sample values
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sampleValues.map((sample) => (
                          <Badge key={sample} variant="neutral" className="normal-case tracking-normal">
                            {sample}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {field.warnings?.length ? (
                    <div className="space-y-2 rounded-[calc(var(--radius)-10px)] border border-warning/30 bg-warning/10 px-3 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-warning">
                        Warnings
                      </div>
                      <div className="space-y-1 text-sm text-warning">
                        {field.warnings.map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Dialog>
    </>
  );
}
