import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { sql } from "@codemirror/lang-sql";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isWidgetReferenceExpression } from "@/dashboards/widget-reference-language";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";

const EMPTY_EDITOR_EXTENSIONS: readonly Extension[] = [];
const SQL_EDITOR_EXTENSIONS: readonly Extension[] = [sql()];

const queryEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
    minHeight: "260px",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    fontSize: "0.75rem",
    lineHeight: "1.5rem",
    padding: "0.75rem 0.5rem",
  },
  ".cm-gutters": {
    backgroundColor: "color-mix(in srgb, var(--muted) 24%, transparent)",
    borderRight: "1px solid color-mix(in srgb, var(--border) 70%, transparent)",
    color: "var(--muted-foreground)",
  },
  ".cm-line": {
    padding: "0 0.625rem",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
  },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    minHeight: "260px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--primary) 28%, transparent) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--muted) 18%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--muted) 24%, transparent)",
    color: "var(--foreground)",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

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
  hideLabel = false,
  label,
}: {
  children: ReactNode;
  className?: string;
  help?: ReactNode;
  hideLabel?: boolean;
  label: ReactNode;
}) {
  return (
    <div className={["block space-y-1.5", className].filter(Boolean).join(" ")}>
      {hideLabel ? null : (
        <WidgetSettingFieldLabel help={help} textClassName="text-xs font-medium text-muted-foreground">
          {label}
        </WidgetSettingFieldLabel>
      )}
      {children}
    </div>
  );
}

export function QueryTextField({
  disabled,
  help,
  hideLabel,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  hideLabel?: boolean;
  label: ReactNode;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  value?: string;
}) {
  return (
    <ConnectionQueryField help={help} hideLabel={hideLabel} label={label}>
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
  hideLabel,
  label,
  min,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  hideLabel?: boolean;
  label: ReactNode;
  min?: number;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  value?: number;
}) {
  return (
    <ConnectionQueryField help={help} hideLabel={hideLabel} label={label}>
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

export function QueryCodeField({
  ariaLabel,
  disabled,
  extensions = EMPTY_EDITOR_EXTENSIONS,
  help,
  hideLabel,
  languageLabel,
  label,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel?: string;
  disabled?: boolean;
  extensions?: readonly Extension[];
  help?: ReactNode;
  hideLabel?: boolean;
  languageLabel: string;
  label: ReactNode;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  value?: string;
}) {
  const editorExtensions = useMemo(
    () => [
      queryEditorTheme,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...extensions,
    ],
    [extensions],
  );

  return (
    <ConnectionQueryField className="md:col-span-2" help={help} hideLabel={hideLabel} label={label}>
      <div
        className={[
          "overflow-hidden rounded-[calc(var(--radius)-6px)] border border-input bg-background/70 shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          disabled ? "opacity-65" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-no-widget-drag="true"
      >
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 px-3 py-1.5">
          <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
            {languageLabel}
          </span>
        </div>
        <CodeMirror
          value={value ?? ""}
          onChange={(nextValue) => {
            onChange(nextValue || undefined);
          }}
          readOnly={disabled}
          editable={!disabled}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            autocompletion: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            highlightSelectionMatches: true,
            searchKeymap: true,
            lintKeymap: false,
          }}
          extensions={editorExtensions}
          theme="none"
          minHeight="260px"
          placeholder={placeholder}
          aria-label={ariaLabel ?? `${languageLabel} editor`}
        />
      </div>
    </ConnectionQueryField>
  );
}

export function QuerySqlField({
  disabled,
  help,
  hideLabel,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  hideLabel?: boolean;
  label: ReactNode;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  value?: string;
}) {
  return (
    <QueryCodeField
      ariaLabel="SQL editor"
      disabled={disabled}
      extensions={SQL_EDITOR_EXTENSIONS}
      help={help}
      hideLabel={hideLabel}
      label={label}
      languageLabel="SQL"
      onChange={onChange}
      placeholder={placeholder}
      value={value}
    />
  );
}

export interface QueryStringListSuggestion {
  value: string;
  label?: string;
  description?: string;
}

function normalizeStringList(
  value: unknown,
  normalizeEntry?: (value: string) => string,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value.flatMap((entry) => {
    if (typeof entry !== "string") {
      return [];
    }

    const trimmed = normalizeEntry ? normalizeEntry(entry.trim()) : entry.trim();

    if (!trimmed || seen.has(trimmed)) {
      return [];
    }

    seen.add(trimmed);
    return [trimmed];
  });
}

function parseStringList(
  value: string,
  normalizeEntry?: (value: string) => string,
) {
  const seen = new Set<string>();

  return value
    .split(/[\n,]/)
    .map((entry) => (normalizeEntry ? normalizeEntry(entry.trim()) : entry.trim()))
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
  hideLabel,
  label,
  normalizeEntry,
  onChange,
  placeholder,
  suggestions,
  value,
}: {
  disabled?: boolean;
  help?: ReactNode;
  hideLabel?: boolean;
  label: ReactNode;
  normalizeEntry?: (value: string) => string;
  onChange: (value: string[] | undefined) => void;
  placeholder?: string;
  suggestions?: readonly QueryStringListSuggestion[];
  value?: unknown;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const entries = useMemo(
    () => normalizeStringList(value, normalizeEntry),
    [normalizeEntry, value],
  );
  const availableSuggestions = useMemo(
    () =>
      (suggestions ?? []).flatMap((suggestion) => {
        const normalizedValue = normalizeEntry
          ? normalizeEntry(suggestion.value)
          : suggestion.value.trim();

        if (!normalizedValue || entries.includes(normalizedValue)) {
          return [];
        }

        return [
          {
            ...suggestion,
            value: normalizedValue,
            label: suggestion.label ?? normalizedValue,
          },
        ];
      }),
    [entries, normalizeEntry, suggestions],
  );
  const [draft, setDraft] = useState("");
  const editingEntryRef = useRef(false);

  useEffect(() => {
    const nextEntries = normalizeStringList(value, normalizeEntry);

    if (nextEntries.length === 0) {
      if (editingEntryRef.current) {
        editingEntryRef.current = false;
        return;
      }

      setDraft("");
      return;
    }

    editingEntryRef.current = false;
  }, [normalizeEntry, value]);

  function updateEntries(nextEntries: string[]) {
    onChange(nextEntries.length > 0 ? nextEntries : undefined);
  }

  function appendEntries(nextDraft = draft) {
    const parsedEntries = parseStringList(nextDraft, normalizeEntry);

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

  function appendEntry(entry: string) {
    const [nextEntry] = parseStringList(entry, normalizeEntry);

    if (!nextEntry || entries.includes(nextEntry)) {
      return;
    }

    updateEntries([...entries, nextEntry]);
    setDraft("");
    inputRef.current?.focus();
  }

  function removeEntry(entryToRemove: string) {
    updateEntries(entries.filter((entry) => entry !== entryToRemove));
  }

  function editEntry(entryToEdit: string) {
    if (disabled) {
      return;
    }

    editingEntryRef.current = true;
    updateEntries(entries.filter((entry) => entry !== entryToEdit));
    setDraft(entryToEdit);

    const focusDraft = () => {
      const input = inputRef.current;

      if (!input) {
        return;
      }

      input.focus();
      input.setSelectionRange(entryToEdit.length, entryToEdit.length);
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focusDraft);
    } else {
      focusDraft();
    }
  }

  function commitReferenceDraft(
    nextValue: string,
    options?: {
      completionKind?: "widget" | "source" | "field";
      reason?: "completion" | "enter";
    },
  ) {
    if (!isWidgetReferenceExpression(nextValue)) {
      return;
    }

    const shouldCommitImmediately =
      options?.reason === "enter" || options?.completionKind === "field";

    if (!shouldCommitImmediately) {
      return;
    }

    appendEntries(nextValue);
  }

  return (
    <ConnectionQueryField help={help} hideLabel={hideLabel} label={label}>
      <div
        className={[
          "min-h-24 rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-2 py-2 shadow-sm transition-colors focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-ring/30",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => inputRef.current?.focus()}
        data-no-widget-drag="true"
      >
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <span
              key={entry}
              className="inline-flex max-w-full cursor-text items-center gap-1 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-muted/55 px-2 py-1 font-mono text-xs text-foreground"
              title="Click to edit"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                editEntry(entry);
              }}
            >
              <span className="truncate">{entry}</span>
              <button
                type="button"
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeEntry(entry);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                disabled={disabled}
                aria-label={`Remove ${entry}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Input
            ref={inputRef}
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
                const lastEntry = entries.at(-1);

                if (lastEntry) {
                  editEntry(lastEntry);
                }
              }
            }}
            onBlur={() => {
              appendEntries();
            }}
            onWidgetReferenceCommit={({ value, option, reason }) => {
              commitReferenceDraft(value, {
                completionKind: option?.kind,
                reason,
              });
            }}
            disabled={disabled}
            placeholder={entries.length === 0 ? placeholder?.split(/\n|,/)[0] : "Add value"}
            spellCheck={false}
            className="h-7 min-w-40 flex-1 border-0 bg-transparent px-1 py-0 font-mono text-xs shadow-none focus:border-0 focus:ring-0"
          />
        </div>
        {availableSuggestions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
            {availableSuggestions.map((suggestion) => (
              <button
                key={suggestion.value}
                type="button"
                className="inline-flex max-w-full items-center rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/65 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  appendEntry(suggestion.value);
                }}
                disabled={disabled}
                title={suggestion.description}
              >
                <span className="truncate">{suggestion.label}</span>
              </button>
            ))}
          </div>
        ) : null}
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
