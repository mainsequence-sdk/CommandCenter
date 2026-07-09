import * as React from "react";

import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  actionLabel?: string;
  actionOnSelect?: () => void;
  emptyMessage?: string;
  fitContent?: boolean;
  listboxPlacement?: "bottom" | "top";
  searchable?: boolean;
  searchPlaceholder?: string;
}

interface SelectOption {
  disabled?: boolean;
  description?: string;
  label: string;
  value: string;
}

type SelectOptionElementProps = React.OptionHTMLAttributes<HTMLOptionElement> & {
  "data-description"?: string;
};

function flattenOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }

    if (child.type === "option") {
      const props = child.props as SelectOptionElementProps;
      const label =
        typeof props.children === "string"
          ? props.children
          : React.Children.toArray(props.children).join("").trim();

      options.push({
        description:
          typeof props["data-description"] === "string" && props["data-description"].trim()
            ? props["data-description"].trim()
            : undefined,
        disabled: props.disabled,
        label,
        value: String(props.value ?? ""),
      });
      return;
    }

    if (child.type === "optgroup") {
      options.push(...flattenOptions((child.props as { children?: React.ReactNode }).children));
    }
  });

  return options;
}

function useControllableStringValue(value: unknown, defaultValue: unknown) {
  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
    defaultValue === undefined ? "" : String(defaultValue),
  );

  return {
    controlled,
    currentValue: controlled ? String(value ?? "") : uncontrolledValue,
    setUncontrolledValue,
  };
}

function normalizeSelectValue(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function matchesSearch(option: SelectOption, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    option.label,
    option.description ?? "",
    option.value,
  ].join(" ").toLowerCase();

  return haystack.includes(query);
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      children,
      className,
      defaultValue,
      disabled = false,
      actionLabel,
      actionOnSelect,
      emptyMessage = "No options matched the search.",
      fitContent = false,
      listboxPlacement = "bottom",
      multiple,
      name,
      onChange,
      searchable = false,
      searchPlaceholder = "Search options",
      value,
      ...props
    },
    forwardedRef,
  ) => {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const hiddenSelectRef = React.useRef<HTMLSelectElement | null>(null);
    const [open, setOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState("");
    const options = React.useMemo(() => flattenOptions(children), [children]);
    const { controlled, currentValue, setUncontrolledValue } = useControllableStringValue(
      value,
      defaultValue,
    );
    const normalizedCurrentValue = normalizeSelectValue(currentValue);
    const selectedOption =
      options.find((option) => normalizeSelectValue(option.value) === normalizedCurrentValue) ?? null;
    const normalizedSearchValue = searchValue.trim().toLowerCase();
    const visibleOptions = searchable
      ? options.filter((option) => matchesSearch(option, normalizedSearchValue))
      : options;

    React.useImperativeHandle(forwardedRef, () => hiddenSelectRef.current as HTMLSelectElement, []);

    React.useEffect(() => {
      if (!open) {
        setSearchValue("");
        return undefined;
      }

      function handlePointerDown(event: PointerEvent) {
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

      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [open]);

    React.useEffect(() => {
      if (multiple) {
        setOpen(false);
      }
    }, [multiple]);

    function commit(nextValue: string) {
      if (!controlled) {
        setUncontrolledValue(nextValue);
      }

      onChange?.({
        target: { value: nextValue, name } as EventTarget & HTMLSelectElement,
        currentTarget: { value: nextValue, name } as EventTarget & HTMLSelectElement,
      } as React.ChangeEvent<HTMLSelectElement>);
      setOpen(false);
    }

    if (multiple) {
      return (
        <select
          ref={forwardedRef}
          className={cn(
            "flex h-8 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-2.5 py-1.5 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30",
            className,
          )}
          disabled={disabled}
          multiple
          name={name}
          onChange={onChange}
          value={value}
          {...props}
        >
          {children}
        </select>
      );
    }

    return (
      <div ref={rootRef} className="relative">
        <select
          ref={hiddenSelectRef}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          disabled={disabled}
          name={name}
          onChange={onChange}
          value={currentValue}
          {...props}
        >
          {children}
        </select>

        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "flex min-h-8 items-center justify-between gap-2 rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-2.5 py-1.5 text-left text-sm text-foreground shadow-sm outline-none transition-colors hover:border-primary/35 hover:bg-muted/25 focus:border-primary/70 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
            fitContent ? "w-auto min-w-full" : "w-full",
            open && "border-primary/60 bg-muted/35",
            className,
          )}
          onClick={() => {
            if (!disabled) {
              setOpen((current) => !current);
            }
          }}
        >
          <span
            className={cn(
              "min-w-0 flex-1",
              selectedOption || normalizedCurrentValue ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selectedOption?.description ? (
              <span className="flex min-w-0 flex-col">
                <span className={cn("truncate", fitContent && "whitespace-nowrap")}>
                  {selectedOption.label}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {selectedOption.description}
                </span>
              </span>
            ) : (
              <span className={cn(fitContent ? "whitespace-nowrap" : "truncate")}>
                {selectedOption?.label ??
                  (normalizedCurrentValue ? currentValue : options[0]?.label ?? "Select an option")}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open ? (
          <div
            role="listbox"
            className={cn(
              "absolute left-0 z-40 overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-1.5 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur",
              fitContent ? "w-max min-w-full" : "right-0",
              listboxPlacement === "top"
                ? "bottom-[calc(100%+0.5rem)]"
                : "top-[calc(100%+0.5rem)]",
            )}
          >
            {actionLabel && actionOnSelect ? (
              <>
                <button
                  type="button"
                  className="mb-1 flex w-full items-center rounded-[calc(var(--radius)-6px)] px-2.5 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  onClick={() => {
                    actionOnSelect();
                    setOpen(false);
                  }}
                >
                  {actionLabel}
                </button>
                <div className="mb-1 border-t border-border/70" />
              </>
            ) : null}
            {searchable ? (
              <div className="border-b border-border/70 p-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    type="search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-8 w-full rounded-[calc(var(--radius)-7px)] border border-border/70 bg-background/55 px-2.5 pl-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/65 focus:ring-2 focus:ring-ring/25"
                  />
                </div>
              </div>
            ) : null}
            <div className="max-h-72 overflow-y-auto">
              {visibleOptions.length === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] px-2.5 py-4 text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : null}
              {visibleOptions.map((option) => {
                const selected = option.value === currentValue;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    className={cn(
                      "flex w-full gap-2 rounded-[calc(var(--radius)-6px)] px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/45 disabled:pointer-events-none disabled:opacity-40",
                      option.description ? "items-start" : "items-center",
                      selected && "bg-primary/12 text-topbar-foreground",
                    )}
                    onClick={() => {
                      if (!option.disabled) {
                        commit(option.value);
                      }
                    }}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      {option.description ? (
                        <span className="flex min-w-0 flex-col">
                          <span className={cn(fitContent ? "whitespace-nowrap" : "truncate")}>
                            {option.label}
                          </span>
                          <span
                            className={cn(
                              "text-[11px] text-muted-foreground",
                              fitContent ? "whitespace-nowrap" : "truncate",
                            )}
                          >
                            {option.description}
                          </span>
                        </span>
                      ) : (
                        <span className={cn(fitContent ? "whitespace-nowrap" : "truncate")}>
                          {option.label}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";
