import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { AppComponentServiceHeader } from "./appComponentModel";

export function AppComponentServiceHeadersEditor({
  editable = true,
  headers,
  onChange,
}: {
  editable?: boolean;
  headers?: AppComponentServiceHeader[];
  onChange: (headers: AppComponentServiceHeader[] | undefined) => void;
}) {
  const currentHeaders = headers ?? [];

  function updateHeader(
    index: number,
    patch: Partial<AppComponentServiceHeader>,
  ) {
    const nextHeaders = currentHeaders.map((header, headerIndex) =>
      headerIndex === index
        ? {
            ...header,
            ...patch,
          }
        : header,
    );

    onChange(nextHeaders.length > 0 ? nextHeaders : undefined);
  }

  function addHeader() {
    onChange([
      ...currentHeaders,
      {
        name: "",
        value: "",
      },
    ]);
  }

  function removeHeader(index: number) {
    const nextHeaders = currentHeaders.filter((_, headerIndex) => headerIndex !== index);
    onChange(nextHeaders.length > 0 ? nextHeaders : undefined);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-topbar-foreground">Additional headers</div>
        <p className="text-sm text-muted-foreground">
          These static headers are applied to both OpenAPI discovery and request execution. OpenAPI
          header parameters still render separately as generated request inputs.
        </p>
      </div>

      {currentHeaders.length > 0 ? (
        <div className="space-y-3">
          {currentHeaders.map((header, index) => (
            <div
              key={`service-header:${index}`}
              className="grid gap-3 rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 p-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto]"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium text-topbar-foreground">Header name</span>
                <Input
                  value={header.name}
                  readOnly={!editable}
                  placeholder="X-Api-Key"
                  onChange={(event) => {
                    updateHeader(index, {
                      name: event.target.value,
                    });
                  }}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-topbar-foreground">Header value</span>
                <Input
                  value={header.value}
                  readOnly={!editable}
                  placeholder="secret-value"
                  onChange={(event) => {
                    updateHeader(index, {
                      value: event.target.value,
                    });
                  }}
                />
              </label>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!editable}
                  onClick={() => {
                    removeHeader(index);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[calc(var(--radius)-7px)] border border-dashed border-border/70 bg-background/18 px-4 py-3 text-sm text-muted-foreground">
          No additional headers configured.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Blank header names are ignored until they are filled in.
        </div>
        <Button type="button" variant="secondary" disabled={!editable} onClick={addHeader}>
          <Plus className="h-4 w-4" />
          Add header
        </Button>
      </div>
    </div>
  );
}
