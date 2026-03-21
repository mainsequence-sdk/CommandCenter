import * as React from "react";

import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

interface SelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

function flattenOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }

    if (child.type === "option") {
      const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
      const label =
        typeof props.children === "string"
          ? props.children
          : React.Children.toArray(props.children).join("").trim();

      options.push({
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

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      children,
      className,
      defaultValue,
      disabled = false,
      multiple,
      name,
      onChange,
      value,
      ...props
    },
    forwardedRef,
  ) => {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const hiddenSelectRef = React.useRef<HTMLSelectElement | null>(null);
    const [open, setOpen] = React.useState(false);
    const options = React.useMemo(() => flattenOptions(children), [children]);
    const { controlled, currentValue, setUncontrolledValue } = useControllableStringValue(
      value,
      defaultValue,
    );
    const selectedOption = options.find((option) => option.value === currentValue) ?? null;

    React.useImperativeHandle(forwardedRef, () => hiddenSelectRef.current as HTMLSelectElement, []);

    React.useEffect(() => {
      if (!open) {
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
            "flex h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30",
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
            "flex h-10 w-full items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-left text-sm text-foreground shadow-sm outline-none transition-colors hover:border-primary/35 hover:bg-muted/25 focus:border-primary/70 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-primary/60 bg-muted/35",
            className,
          )}
          onClick={() => {
            if (!disabled) {
              setOpen((current) => !current);
            }
          }}
        >
          <span className={cn("truncate", selectedOption ? "text-foreground" : "text-muted-foreground")}>
            {selectedOption?.label ?? options[0]?.label ?? "Select an option"}
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
            className="absolute top-[calc(100%+0.5rem)] left-0 right-0 z-40 overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-1.5 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
          >
            <div className="max-h-72 overflow-y-auto">
              {options.map((option) => {
                const selected = option.value === currentValue;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2 text-left text-sm transition-colors hover:bg-muted/45 disabled:pointer-events-none disabled:opacity-40",
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
                    <span className="truncate">{option.label}</span>
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
