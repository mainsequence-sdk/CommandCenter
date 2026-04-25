import { useEffect, useState, type ReactNode } from "react";

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
    <label className={["block space-y-1.5", className].filter(Boolean).join(" ")}>
      <WidgetSettingFieldLabel help={help} textClassName="text-xs font-medium text-muted-foreground">
        {label}
      </WidgetSettingFieldLabel>
      {children}
    </label>
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
      <Textarea
        value={value ?? ""}
        onChange={(event) => {
          onChange(event.target.value || undefined);
        }}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        className="min-h-48 font-mono text-xs"
      />
    </ConnectionQueryField>
  );
}

function stringifyStringList(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry) => (typeof entry === "string" ? [entry] : [])).join("\n")
    : "";
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
  const [draft, setDraft] = useState(() => stringifyStringList(value));

  useEffect(() => {
    setDraft(stringifyStringList(value));
  }, [value]);

  function commit(nextDraft = draft) {
    const nextList = parseStringList(nextDraft);
    onChange(nextList.length > 0 ? nextList : undefined);
  }

  return (
    <ConnectionQueryField help={help} label={label}>
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
