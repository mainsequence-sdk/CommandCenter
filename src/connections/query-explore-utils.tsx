import type { CommandCenterFrame, ConnectionQueryResponse } from "@/connections/types";

export function parseConnectionQueryParameters(value: string) {
  const parameters: Record<string, string | number | boolean | null> = {};

  for (const line of value.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      throw new Error("Parameters must use key=value lines.");
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key) {
      throw new Error("Parameter key is required.");
    }

    if (rawValue === "true" || rawValue === "false") {
      parameters[key] = rawValue === "true";
      continue;
    }

    if (rawValue === "null") {
      parameters[key] = null;
      continue;
    }

    const numericValue = Number(rawValue);
    parameters[key] = rawValue && Number.isFinite(numericValue) ? numericValue : rawValue;
  }

  return parameters;
}

export function summarizeConnectionQueryResponse(response: ConnectionQueryResponse) {
  const fieldCount = response.frames?.reduce((count, frame) => count + frame.fields.length, 0) ?? 0;
  const rowCount = response.frames?.[0]?.fields[0]?.values.length ?? 0;

  return [
    `${response.frames?.length ?? 0} frames`,
    `${fieldCount} fields`,
    `${rowCount} rows`,
    response.warnings?.length ? `${response.warnings.length} warnings` : undefined,
    response.traceId ? `trace ${response.traceId}` : undefined,
  ].filter((entry): entry is string => Boolean(entry));
}

export function formatConnectionQueryJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function ConnectionFramePreview({ frame }: { frame?: CommandCenterFrame }) {
  if (!frame || frame.fields.length === 0) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
        No frame rows returned.
      </div>
    );
  }

  const rowCount = Math.max(0, ...frame.fields.map((field) => field.values.length));
  const visibleRows = Math.min(rowCount, 50);

  return (
    <div className="overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70">
      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-muted/80 text-muted-foreground backdrop-blur">
            <tr>
              {frame.fields.map((field) => (
                <th key={field.name} className="border-b border-border/70 px-3 py-2 font-semibold">
                  {field.config?.displayName ?? field.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: visibleRows }, (_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/40 last:border-b-0">
                {frame.fields.map((field) => (
                  <td key={field.name} className="max-w-[280px] truncate px-3 py-2">
                    {formatCellValue(field.values[rowIndex])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rowCount > visibleRows ? (
        <div className="border-t border-border/70 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          Showing first {visibleRows} of {rowCount} rows.
        </div>
      ) : null}
    </div>
  );
}
