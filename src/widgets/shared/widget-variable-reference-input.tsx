import {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  resolveWidgetReferenceCompletionContext,
  resolveWidgetReferenceDisplayToken,
  type WidgetReferenceCompletionContext,
  type WidgetReferenceCompletionOption,
  type WidgetReferenceDisplayToken,
  type WidgetReferenceLanguageSourceWidget,
} from "@/dashboards/widget-reference-language";

interface WidgetVariableReferenceInputContextValue {
  enabled: boolean;
  sourceWidgets: WidgetReferenceLanguageSourceWidget[];
}

type WidgetVariableReferenceTextElement = HTMLInputElement | HTMLTextAreaElement;

export const WIDGET_VARIABLE_REFERENCE_INPUT_CLASS = "ms-widget-variable-reference-input";
export const WIDGET_VARIABLE_REFERENCE_INPUT_DATA_ATTRIBUTE = "data-widget-variable-reference-input";

export interface WidgetVariableReferenceInsertion {
  option: WidgetReferenceCompletionOption;
  value: string;
}

const WidgetVariableReferenceInputContext =
  createContext<WidgetVariableReferenceInputContextValue | null>(null);

export function WidgetVariableReferenceInputProvider({
  children,
  enabled = true,
  sourceWidgets,
}: {
  children: ReactNode;
  enabled?: boolean;
  sourceWidgets: WidgetReferenceLanguageSourceWidget[];
}) {
  const value = useMemo(
    () => ({
      enabled,
      sourceWidgets,
    }),
    [enabled, sourceWidgets],
  );

  return (
    <WidgetVariableReferenceInputContext.Provider value={value}>
      <WidgetVariableReferenceInputScope sourceWidgets={sourceWidgets} enabled={enabled}>
        {children}
      </WidgetVariableReferenceInputScope>
    </WidgetVariableReferenceInputContext.Provider>
  );
}

function setComposedRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  ref.current = value;
}

export function useComposedWidgetVariableReferenceRef<T>(
  forwardedRef: Ref<T> | undefined,
) {
  const localRef = useRef<T | null>(null);

  const composedRef = (value: T | null) => {
    localRef.current = value;
    setComposedRef(forwardedRef, value);
  };

  return [localRef, composedRef] as const;
}

function setNativeTextValue(element: WidgetVariableReferenceTextElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
}

function dispatchTextChange<TElement extends HTMLInputElement | HTMLTextAreaElement>(
  element: TElement,
  onChange: ChangeEventHandler<TElement> | undefined,
  nextValue: string,
) {
  setNativeTextValue(element, nextValue);

  if (!onChange) {
    return;
  }

  onChange({
    target: element,
    currentTarget: element,
  } as unknown as Parameters<ChangeEventHandler<TElement>>[0]);
}

function dispatchNativeTextInput(element: WidgetVariableReferenceTextElement, nextValue: string) {
  setNativeTextValue(element, nextValue);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertWidgetReferenceCompletion(
  element: WidgetVariableReferenceTextElement,
  option: WidgetReferenceCompletionOption,
  completion: WidgetReferenceCompletionContext | null,
  onChange?: ChangeEventHandler<WidgetVariableReferenceTextElement>,
) {
  const selectionStart = element.selectionStart ?? element.value.length;
  const selectionEnd = element.selectionEnd ?? selectionStart;
  const replacementStart = completion?.replacementStart ?? selectionStart;
  const replacementEnd = completion?.replacementEnd ?? selectionEnd;
  const nextValue = `${element.value.slice(0, replacementStart)}${option.insertText}${element.value.slice(replacementEnd)}`;
  const nextCursor = replacementStart + option.insertText.length;

  if (onChange) {
    dispatchTextChange(element, onChange, nextValue);
  } else {
    dispatchNativeTextInput(element, nextValue);
  }

  const restoreSelection = () => {
    element.focus();
    element.setSelectionRange(nextCursor, nextCursor);
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(restoreSelection);
  } else {
    restoreSelection();
  }

  return nextValue;
}

export function useWidgetVariableReferenceTextField<
  TElement extends HTMLInputElement | HTMLTextAreaElement,
>(input: {
  disabled?: boolean;
  onChange?: ChangeEventHandler<TElement>;
  onCompletionInserted?: (insertion: WidgetVariableReferenceInsertion) => void;
  readOnly?: boolean;
  value?: unknown;
}) {
  const context = useContext(WidgetVariableReferenceInputContext);
  const listId = useId();
  const [completion, setCompletion] = useState<WidgetReferenceCompletionContext | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const sourceWidgets = context?.enabled ? context.sourceWidgets : [];
  const eligible =
    context?.enabled === true &&
    !input.disabled &&
    !input.readOnly &&
    sourceWidgets.length > 0;

  const options = useMemo(() => {
    return completion?.options ?? [];
  }, [completion?.options]);
  const referenceToken = useMemo(
    () =>
      eligible
        ? resolveWidgetReferenceDisplayToken({
            sourceWidgets,
            value: input.value,
          })
        : null,
    [eligible, input.value, sourceWidgets],
  );

  function updateOpenState(element: TElement) {
    if (!eligible) {
      setCompletion(null);
      return;
    }

    const nextCompletion = resolveWidgetReferenceCompletionContext({
      sourceWidgets,
      value: element.value,
      selectionStart: element.selectionStart,
    });

    setCompletion(nextCompletion);
    setActiveIndex(0);
  }

  function closePicker() {
    setCompletion(null);
    setActiveIndex(0);
  }

  function insertOption(element: TElement, option: WidgetReferenceCompletionOption) {
    const nextValue = insertWidgetReferenceCompletion(
      element,
      option,
      completion,
      input.onChange as ChangeEventHandler<WidgetVariableReferenceTextElement> | undefined,
    );

    input.onCompletionInserted?.({
      option,
      value: nextValue,
    });
    closePicker();
  }

  function clearReference(element: TElement) {
    if (input.onChange) {
      dispatchTextChange(element, input.onChange, "");
    } else {
      dispatchNativeTextInput(element, "");
    }

    closePicker();
  }

  const onChange: ChangeEventHandler<TElement> = (event) => {
    input.onChange?.(event);

    updateOpenState(event.currentTarget);
  };

  const onKeyDown: KeyboardEventHandler<TElement> = (event) => {
    if (!completion) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      const selected = options[activeIndex];

      if (!selected) {
        return;
      }

      event.preventDefault();
      insertOption(event.currentTarget, selected);
    }
  };

  const onSelectOption = (
    element: TElement | null,
    option: WidgetReferenceCompletionOption,
  ): MouseEventHandler<HTMLButtonElement> => (event) => {
    event.preventDefault();

    if (!element) {
      return;
    }

    insertOption(element, option);
  };

  return {
    activeIndex,
    closePicker,
    eligible,
    listId,
    onChange,
    onKeyDown,
    onSelectOption,
    open: eligible && Boolean(completion),
    options,
    referenceToken,
    clearReference,
    updateOpenState,
  };
}

export function WidgetVariableReferenceTokenOverlay<TElement extends HTMLInputElement | HTMLTextAreaElement>({
  inputElementRef,
  onClear,
  onEdit,
  token,
}: {
  inputElementRef: RefObject<TElement | null>;
  onClear: (element: TElement) => void;
  onEdit: (element: TElement) => void;
  token: WidgetReferenceDisplayToken;
}) {
  return (
    <div
      className="absolute inset-px z-10 flex min-w-0 items-center bg-card/95 px-2"
      onMouseDown={(event) => {
        event.preventDefault();
        const inputElement = inputElementRef.current;

        if (!inputElement) {
          return;
        }

        onEdit(inputElement);
      }}
    >
      <span
        className="flex max-w-full items-center gap-2 rounded-[5px] border border-primary/35 bg-primary/12 px-2 py-1 text-sm text-primary shadow-sm"
        title={token.expression}
      >
        <span className="min-w-0 truncate font-medium">{token.label}</span>
        <span className="shrink-0 font-mono text-[11px] text-primary/72">{token.detail}</span>
        <button
          type="button"
          className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-primary/80 transition-colors hover:bg-primary/18 hover:text-primary"
          aria-label={`Remove reference ${token.label}`}
          title="Remove reference"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const inputElement = inputElementRef.current;

            if (inputElement) {
              onClear(inputElement);
            }
          }}
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}

export function WidgetVariableReferencePicker<TElement extends HTMLInputElement | HTMLTextAreaElement>({
  activeIndex,
  inputElement,
  listId,
  onSelectOption,
  open,
  options,
  style,
  variant = "inline",
}: {
  activeIndex: number;
  inputElement: TElement | null;
  listId: string;
  onSelectOption: (
    element: TElement | null,
    option: WidgetReferenceCompletionOption,
  ) => MouseEventHandler<HTMLButtonElement>;
  open: boolean;
  options: WidgetReferenceCompletionOption[];
  style?: CSSProperties;
  variant?: "inline" | "fixed";
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      id={listId}
      role="listbox"
      style={style}
      className={cn(
        "z-50 max-h-64 overflow-auto rounded-none border border-border/80 bg-popover text-popover-foreground shadow-[var(--shadow-panel)]",
        variant === "fixed"
          ? "fixed"
          : "absolute left-0 right-0 top-[calc(100%+4px)]",
      )}
    >
      {options.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">No matching references</div>
      ) : (
        options.map((option, index) => {
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "grid w-full gap-1 px-3 py-2 text-left text-sm transition-colors",
                index === activeIndex
                  ? "bg-primary/14 text-foreground"
                  : "hover:bg-muted/45",
              )}
              onMouseDown={onSelectOption(inputElement, option)}
            >
              <span className="truncate font-medium">{option.label}</span>
              {option.detail ? (
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {option.detail}
                </span>
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}

export function isWidgetVariableReferenceTextInputType(type: string | undefined) {
  if (!type) {
    return true;
  }

  return ["text", "search", "url", "email", "tel"].includes(type);
}

function isVariableReferenceClassTarget(
  element: Element | null,
): element is WidgetVariableReferenceTextElement {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return false;
  }

  if (element.dataset.widgetVariableReferenceOwned === "true") {
    return false;
  }

  const optedIn =
    element.classList.contains(WIDGET_VARIABLE_REFERENCE_INPUT_CLASS) ||
    element.getAttribute(WIDGET_VARIABLE_REFERENCE_INPUT_DATA_ATTRIBUTE) === "true";

  if (!optedIn || element.disabled || element.readOnly) {
    return false;
  }

  return element instanceof HTMLTextAreaElement ||
    isWidgetVariableReferenceTextInputType(element.type);
}

function resolveVariableReferenceClassTarget(
  target: EventTarget | null,
  scope: HTMLElement,
) {
  if (!(target instanceof Element)) {
    return null;
  }

  const candidate = target.closest<WidgetVariableReferenceTextElement>(
    `.${WIDGET_VARIABLE_REFERENCE_INPUT_CLASS}, [${WIDGET_VARIABLE_REFERENCE_INPUT_DATA_ATTRIBUTE}="true"]`,
  );

  if (!candidate || !scope.contains(candidate) || !isVariableReferenceClassTarget(candidate)) {
    return null;
  }

  return candidate;
}

function WidgetVariableReferenceInputScope({
  children,
  enabled,
  sourceWidgets,
}: {
  children: ReactNode;
  enabled: boolean;
  sourceWidgets: WidgetReferenceLanguageSourceWidget[];
}) {
  const listId = useId();
  const [activeElement, setActiveElement] = useState<WidgetVariableReferenceTextElement | null>(null);
  const [completion, setCompletion] = useState<WidgetReferenceCompletionContext | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties | undefined>();
  const eligible = enabled && sourceWidgets.length > 0;
  const options = useMemo(() => completion?.options ?? [], [completion?.options]);
  const open = eligible && Boolean(completion) && Boolean(activeElement);

  function updateAnchor(element: WidgetVariableReferenceTextElement) {
    const rect = element.getBoundingClientRect();

    setAnchorStyle({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }

  function updateOpenState(element: WidgetVariableReferenceTextElement) {
    if (!eligible) {
      setCompletion(null);
      return;
    }

    const nextCompletion = resolveWidgetReferenceCompletionContext({
      sourceWidgets,
      value: element.value,
      selectionStart: element.selectionStart,
    });

    setActiveElement(element);
    setCompletion(nextCompletion);
    setActiveIndex(0);

    if (nextCompletion) {
      updateAnchor(element);
    }
  }

  function closePicker() {
    setCompletion(null);
    setActiveIndex(0);
  }

  const onSelectOption = (
    element: WidgetVariableReferenceTextElement | null,
    option: WidgetReferenceCompletionOption,
  ): MouseEventHandler<HTMLButtonElement> => (event) => {
    event.preventDefault();

    if (!element) {
      return;
    }

    insertWidgetReferenceCompletion(element, option, completion);

    closePicker();
  };

  return (
    <span
      className="contents"
      onInputCapture={(event) => {
        const element = resolveVariableReferenceClassTarget(event.target, event.currentTarget);

        if (element) {
          updateOpenState(element);
        }
      }}
      onClickCapture={(event) => {
        const element = resolveVariableReferenceClassTarget(event.target, event.currentTarget);

        if (element) {
          updateOpenState(element);
        }
      }}
      onFocusCapture={(event) => {
        const element = resolveVariableReferenceClassTarget(event.target, event.currentTarget);

        if (element) {
          updateOpenState(element);
        }
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        const scope = event.currentTarget;

        window.setTimeout(() => {
          if (
            nextTarget instanceof Node &&
            scope.contains(nextTarget)
          ) {
            return;
          }

          closePicker();
        }, 0);
      }}
      onKeyDownCapture={(event) => {
        const element = resolveVariableReferenceClassTarget(event.target, event.currentTarget);

        if (!element || !completion) {
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closePicker();
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((current) => Math.max(current - 1, 0));
          return;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          const selected = options[activeIndex];

          if (!selected) {
            return;
          }

          event.preventDefault();
          insertWidgetReferenceCompletion(element, selected, completion);
          closePicker();
        }
      }}
    >
      {children}
      <WidgetVariableReferencePicker
        activeIndex={activeIndex}
        inputElement={activeElement}
        listId={listId}
        onSelectOption={onSelectOption}
        open={open}
        options={options}
        style={anchorStyle}
        variant="fixed"
      />
    </span>
  );
}
