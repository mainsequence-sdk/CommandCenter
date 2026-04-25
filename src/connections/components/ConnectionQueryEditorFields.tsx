import { useEffect, useMemo, useState, type ReactNode } from "react";

import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

export function ConnectionQueryEditorSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      {title || description ? (
        <div className="space-y-1">
          {title ? <div className="text-sm font-semibold text-foreground">{title}</div> : null}
          {description ? (
            <div className="text-xs leading-relaxed text-muted-foreground">{description}</div>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

export function ConnectionQueryField({
  children,
  className,
  help,
  label,
}: {
  children: ReactNode;
  className?: string;
  help?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className={["block space-y-1.5", className].filter(Boolean).join(" ")}>
      <WidgetSettingFieldLabel help={help} textClassName="text-xs font-medium text-muted-foreground">
        {label}
      </WidgetSettingFieldLabel>
      {children}
    </div>
  );
}

export function QueryTextField({
  disabled,
  help,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  label: ReactNode;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  value?: string;
}) {
  return (
    <ConnectionQueryField help={help} label={label}>
      <Input
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value.trim();
          onChange(nextValue || undefined);
        }}
        disabled={disabled}
        placeholder={placeholder}
      />
    </ConnectionQueryField>
  );
}

export function QueryNumberField({
  disabled,
  help,
  label,
  min,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  label: ReactNode;
  min?: number;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  value?: number;
}) {
  return (
    <ConnectionQueryField help={help} label={label}>
      <Input
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(event) => {
          if (!event.target.value.trim()) {
            onChange(undefined);
            return;
          }

          const nextValue = Number(event.target.value);
          onChange(Number.isFinite(nextValue) ? nextValue : undefined);
        }}
        disabled={disabled}
        placeholder={placeholder}
      />
    </ConnectionQueryField>
  );
}

export function QuerySqlField({
  disabled,
  help,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  label: ReactNode;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  value?: string;
}) {
  return (
    <ConnectionQueryField className="md:col-span-2" help={help} label={label}>
      <div
        className="overflow-hidden rounded-[calc(var(--radius)-6px)] border border-input bg-background/70 shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
        data-no-widget-drag="true"
      >
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 px-3 py-1.5">
          <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
            SQL
          </span>
        </div>
        <Textarea
          value={value ?? ""}
          onChange={(event) => {
            onChange(event.target.value || undefined);
          }}
          disabled={disabled}
          placeholder={placeholder}
          spellCheck={false}
          className="min-h-[260px] resize-y rounded-none border-0 bg-transparent px-4 py-3 font-mono text-xs leading-6 shadow-none outline-none focus-visible:ring-0"
          aria-label="SQL editor"
        />
      </div>
    </ConnectionQueryField>
  );
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value.flatMap((entry) => {
    if (typeof entry !== "string") {
      return [];
    }

    const trimmed = entry.trim();

    if (!trimmed || seen.has(trimmed)) {
      return [];
    }

    seen.add(trimmed);
    return [trimmed];
  });
}

function parseStringList(value: string) {
  const seen = new Set<string>();

  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    });
}

export function QueryStringListField({
  disabled,
  help,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  label: ReactNode;
  onChange: (value: string[] | undefined) => void;
  placeholder?: string;
  value?: unknown;
}) {
  const entries = useMemo(() => normalizeStringList(value), [value]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (normalizeStringList(value).length === 0) {
      setDraft("");
    }
  }, [value]);

  function updateEntries(nextEntries: string[]) {
    onChange(nextEntries.length > 0 ? nextEntries : undefined);
  }

  function appendEntries(nextDraft = draft) {
    const parsedEntries = parseStringList(nextDraft);

    if (parsedEntries.length === 0) {
      setDraft("");
      return;
    }

    const seen = new Set(entries);
    const nextEntries = [...entries];

    parsedEntries.forEach((entry) => {
      if (!seen.has(entry)) {
        seen.add(entry);
        nextEntries.push(entry);
      }
    });

    updateEntries(nextEntries);
    setDraft("");
  }

  function removeEntry(entryToRemove: string) {
    updateEntries(entries.filter((entry) => entry !== entryToRemove));
  }

  return (
    <ConnectionQueryField help={help} label={label}>
      <div
        className={[
          "min-h-24 rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-2 py-2 shadow-sm transition-colors focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-ring/30",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-no-widget-drag="true"
      >
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <span
              key={entry}
              className="inline-flex max-w-full items-center gap-1 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-muted/55 px-2 py-1 font-mono text-xs text-foreground"
            >
              <span className="truncate">{entry}</span>
              <button
                type="button"
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none"
                onClick={(event) => {
                  event.preventDefault();
                  removeEntry(entry);
                }}
                disabled={disabled}
                aria-label={`Remove ${entry}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Input
            value={draft}
            onChange={(event) => {
              const nextDraft = event.target.value;

              if (/[\n,]/.test(nextDraft)) {
                appendEntries(nextDraft);
                return;
              }

              setDraft(nextDraft);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                appendEntries();
                return;
              }

              if (event.key === "Backspace" && draft.length === 0 && entries.length > 0) {
                event.preventDefault();
                updateEntries(entries.slice(0, -1));
              }
            }}
            onBlur={() => {
              appendEntries();
            }}
            disabled={disabled}
            placeholder={entries.length === 0 ? placeholder?.split(/\n|,/)[0] : "Add value"}
            spellCheck={false}
            className="h-7 min-w-40 flex-1 border-0 bg-transparent px-1 py-0 font-mono text-xs shadow-none focus:border-0 focus:ring-0"
          />
        </div>
      </div>
    </ConnectionQueryField>
  );
}

function stringifyJsonRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function parseJsonRecord(value: string) {
  const parsed = value.trim() ? JSON.parse(value) : undefined;

  if (parsed === undefined) {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function QueryJsonRecordField({
  disabled,
  help,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  label: ReactNode;
  onChange: (value: Record<string, unknown> | undefined) => void;
  placeholder?: string;
  value?: unknown;
}) {
  const [draft, setDraft] = useState(() => stringifyJsonRecord(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(stringifyJsonRecord(value));
    setError(null);
  }, [value]);

  function commit(nextDraft = draft) {
    try {
      onChange(parseJsonRecord(nextDraft));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Invalid JSON object.");
    }
  }

  return (
    <ConnectionQueryField className="md:col-span-2" help={help} label={label}>
      <Textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          commit();
        }}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        className="min-h-28 font-mono text-xs"
      />
      {error ? <div className="text-xs text-danger">{error}</div> : null}
    </ConnectionQueryField>
  );
}

export function QueryBooleanField({
  checked,
  disabled,
  help,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  help?: ReactNode;
  label: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2.5">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border bg-transparent accent-primary"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        disabled={disabled}
      />
      <WidgetSettingFieldLabel help={help} textClassName="text-sm font-medium text-foreground">
        {label}
      </WidgetSettingFieldLabel>
    </div>
  );
}
