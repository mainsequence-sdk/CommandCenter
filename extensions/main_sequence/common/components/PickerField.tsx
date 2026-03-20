import { useEffect, useRef, useState } from "react";

import { Check, ChevronDown, Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
}

interface PickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

function matchesSearch(option: PickerOption, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [option.label, option.description ?? "", ...(option.keywords ?? [])]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function PickerField({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage = "No options available.",
  searchPlaceholder = "Search options",
  searchable,
  searchValue,
  onSearchValueChange,
  disabled = false,
  loading = false,
}: PickerFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousValueRef = useRef(value);
  const [open, setOpen] = useState(false);
  const [internalSearchValue, setInternalSearchValue] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const effectiveSearchValue = searchValue ?? internalSearchValue;
  const normalizedQuery = effectiveSearchValue.trim().toLowerCase();
  const filteredOptions = options.filter((option) => matchesSearch(option, normalizedQuery));
  const showSearch = searchable ?? options.length >= 7;

  function updateSearchValue(nextValue: string) {
    if (onSearchValueChange) {
      onSearchValueChange(nextValue);
      return;
    }

    setInternalSearchValue(nextValue);
  }

  useEffect(() => {
    if (!open) {
      updateSearchValue("");
      return undefined;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;

      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && previousValueRef.current !== value) {
      setOpen(false);
    }

    previousValueRef.current = value;
  }, [open, value]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_90%,var(--background)_10%)_0%,color-mix(in_srgb,var(--background)_92%,var(--card)_8%)_100%)] px-3.5 text-left text-sm text-foreground shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent)] transition-colors hover:border-primary/35 hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_94%,var(--background)_6%)_0%,color-mix(in_srgb,var(--background)_88%,var(--card)_12%)_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-60",
          open && "border-primary/55 ring-2 ring-primary/15",
        )}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen((current) => !current);
        }}
      >
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate",
              selectedOption ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>
          {selectedOption?.description ? (
            <span className="block truncate text-xs text-muted-foreground">
              {selectedOption.description}
            </span>
          ) : null}
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      {open ? (
        <div className="absolute top-[calc(100%+0.55rem)] left-0 right-0 z-40 overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/80 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--popover)_94%,var(--background)_6%)_0%,color-mix(in_srgb,var(--background)_94%,var(--popover)_6%)_100%)] shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
          {showSearch ? (
            <div className="border-b border-border/70 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={effectiveSearchValue}
                  onChange={(event) => updateSearchValue(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 border-border/70 bg-background/55 pl-9"
                />
              </div>
            </div>
          ) : null}

          <div className="max-h-72 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center gap-2 rounded-[calc(var(--radius)-8px)] px-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading options
              </div>
            ) : null}

            {!loading && filteredOptions.length === 0 ? (
              <div className="rounded-[calc(var(--radius)-8px)] px-3 py-8 text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : null}

            {!loading
              ? filteredOptions.map((option) => {
                  const selected = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[calc(var(--radius)-8px)] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]",
                        selected && "bg-primary/12 text-topbar-foreground",
                      )}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                        {selected ? <Check className="h-4 w-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{option.label}</span>
                        {option.description ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
