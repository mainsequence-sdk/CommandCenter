import * as React from "react";

import { cn } from "@/lib/utils";
import type { WidgetReferenceCompletionOption } from "@/dashboards/widget-reference-language";
import {
  WIDGET_VARIABLE_REFERENCE_INPUT_CLASS,
  WidgetVariableReferencePicker,
  WidgetVariableReferenceTokenOverlay,
  isWidgetVariableReferenceTextInputType,
  useComposedWidgetVariableReferenceRef,
  useWidgetVariableReferenceTextField,
} from "@/widgets/shared/widget-variable-reference-input";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onWidgetReferenceCommit?: (payload: {
    value: string;
    reason: "completion" | "enter";
    option?: WidgetReferenceCompletionOption;
  }) => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      disabled,
      onChange,
      onClick,
      onFocus,
      onKeyDown,
      onWidgetReferenceCommit,
      readOnly,
      type,
      ...props
    },
    ref,
  ) => {
    const [inputRef, composedRef] = useComposedWidgetVariableReferenceRef(ref);
    const [referenceTokenEditing, setReferenceTokenEditing] = React.useState(false);
    const textInputType = isWidgetVariableReferenceTextInputType(type);
    const variableReference = useWidgetVariableReferenceTextField<HTMLInputElement>({
      disabled: disabled || !textInputType,
      onChange,
      onCompletionInserted: ({ option, value }) => {
        setReferenceTokenEditing(false);
        onWidgetReferenceCommit?.({
          value,
          reason: "completion",
          option,
        });
      },
      readOnly,
      value: props.value,
    });
    const showReferenceToken = Boolean(
      variableReference.eligible &&
      variableReference.referenceToken &&
      !variableReference.open &&
      !referenceTokenEditing,
    );
    const editReferenceToken = (element: HTMLInputElement) => {
      setReferenceTokenEditing(true);

      const focus = () => {
        element.focus();
        element.setSelectionRange(element.value.length, element.value.length);
      };

      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(focus);
      } else {
        focus();
      }
    };
    const input = (
      <input
        ref={composedRef}
        className={cn(
          "flex h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-ring/30",
          variableReference.eligible ? WIDGET_VARIABLE_REFERENCE_INPUT_CLASS : undefined,
          showReferenceToken ? "text-transparent caret-transparent" : undefined,
          className,
        )}
        data-widget-variable-reference-owned={variableReference.eligible ? "true" : undefined}
        disabled={disabled}
        {...props}
        onChange={variableReference.eligible ? variableReference.onChange : onChange}
        onClick={(event) => {
          onClick?.(event);
          variableReference.updateOpenState(event.currentTarget);
        }}
        onFocus={(event) => {
          setReferenceTokenEditing(true);
          onFocus?.(event);
          variableReference.updateOpenState(event.currentTarget);
        }}
        onBlur={(event) => {
          props.onBlur?.(event);
          window.setTimeout(() => {
            setReferenceTokenEditing(false);
          }, 0);
        }}
        onKeyDown={(event) => {
          variableReference.onKeyDown(event);

          if (
            !event.defaultPrevented &&
            event.key === "Enter" &&
          variableReference.referenceToken
        ) {
          event.preventDefault();
          onWidgetReferenceCommit?.({
            value: inputRef.current?.value ?? String(props.value ?? ""),
            reason: "enter",
          });
          setReferenceTokenEditing(false);
          return;
        }

          if (!event.defaultPrevented) {
            onKeyDown?.(event);
          }
        }}
        readOnly={readOnly}
        type={type}
        aria-controls={variableReference.open ? variableReference.listId : props["aria-controls"]}
        aria-expanded={variableReference.open ? true : props["aria-expanded"]}
        aria-haspopup={variableReference.open ? "listbox" : props["aria-haspopup"]}
      />
    );

    if (!variableReference.eligible) {
      return input;
    }

    return (
      <span className="relative block w-full">
        {input}
        {showReferenceToken && variableReference.referenceToken ? (
          <WidgetVariableReferenceTokenOverlay
            inputElementRef={inputRef}
            token={variableReference.referenceToken}
            onEdit={editReferenceToken}
            onClear={(element) => {
              variableReference.clearReference(element);
              setReferenceTokenEditing(true);
              editReferenceToken(element);
            }}
          />
        ) : null}
        <WidgetVariableReferencePicker
          activeIndex={variableReference.activeIndex}
          inputElement={inputRef.current}
          listId={variableReference.listId}
          onSelectOption={variableReference.onSelectOption}
          open={variableReference.open}
          options={variableReference.options}
        />
      </span>
    );
  },
);

Input.displayName = "Input";
