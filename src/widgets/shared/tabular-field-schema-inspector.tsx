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
    return "-";
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

    if (!sample.trim() || sample === "-" || seen.has(sample)) {
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

export function TabularFieldSchemaInspector({
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
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Inspect source schema
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
      >
        {normalizedFields.length === 0 ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-8 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">{formatSummaryCount(summary.backend, "backend")}</Badge>
              <Badge variant="success">{formatSummaryCount(summary.manual, "manual")}</Badge>
              <Badge variant="neutral">{formatSummaryCount(summary.inferred, "inferred")}</Badge>
              <Badge variant="warning">{formatSummaryCount(summary.derived, "derived")}</Badge>
              {summary.warnings > 0 ? (
                <Badge variant="warning">{formatSummaryCount(summary.warnings, "warnings")}</Badge>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search fields"
              />
              <select
                className="h-10 rounded-[calc(var(--radius)-6px)] border border-border bg-card px-3 text-sm text-foreground"
                value={filter}
                onChange={(event) => setFilter(event.target.value as FieldInspectorFilter)}
              >
                <option value="all">All fields</option>
                <option value="backend">Backend</option>
                <option value="manual">Manual</option>
                <option value="inferred">Inferred</option>
                <option value="derived">Derived</option>
                <option value="warnings">Warnings</option>
              </select>
            </div>

            <div className="max-h-[56vh] overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="border-b border-border/70 px-3 py-2">Field</th>
                    <th className="border-b border-border/70 px-3 py-2">Type</th>
                    <th className="border-b border-border/70 px-3 py-2">Source</th>
                    <th className="border-b border-border/70 px-3 py-2">Samples</th>
                    <th className="border-b border-border/70 px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFields.map((field) => {
                    const samples = sampleValuesByKey.get(field.key) ?? [];
                    return (
                      <tr key={field.key}>
                        <td className="border-b border-border/50 px-3 py-2 align-top">
                          <div className="font-medium text-foreground">{field.label ?? field.key}</div>
                          <div className="font-mono text-xs text-muted-foreground">{field.key}</div>
                        </td>
                        <td className="border-b border-border/50 px-3 py-2 align-top">
                          <div>{field.type}</div>
                          {field.nativeType ? (
                            <div className="text-xs text-muted-foreground">{field.nativeType}</div>
                          ) : null}
                        </td>
                        <td className="border-b border-border/50 px-3 py-2 align-top">
                          <Badge variant={getProvenanceVariant(field.provenance)}>
                            {getProvenanceLabel(field.provenance)}
                          </Badge>
                        </td>
                        <td className="border-b border-border/50 px-3 py-2 align-top text-xs text-muted-foreground">
                          {samples.length > 0 ? samples.join(", ") : "-"}
                        </td>
                        <td className="border-b border-border/50 px-3 py-2 align-top text-xs text-muted-foreground">
                          {[field.description, field.reason, ...(field.warnings ?? [])]
                            .filter(Boolean)
                            .join(" ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
