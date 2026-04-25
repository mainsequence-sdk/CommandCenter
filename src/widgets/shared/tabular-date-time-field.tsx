import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

import {
  formatDateTimeLocalValue,
  parseDateTimeLocalValue,
} from "./tabular-widget-source";

export function TabularDateTimeField({
  editable,
  valueMs,
  onChangeValue,
}: {
  editable: boolean;
  valueMs?: number;
  onChangeValue: (valueMs: number | undefined) => void;
}) {
  const [inputValue, setInputValue] = useState(() => formatDateTimeLocalValue(valueMs));

  useEffect(() => {
    setInputValue(formatDateTimeLocalValue(valueMs));
  }, [valueMs]);

  return (
    <Input
      type="datetime-local"
      step={1}
      value={inputValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        setInputValue(nextValue);

        if (!nextValue.trim()) {
          onChangeValue(undefined);
          return;
        }

        const parsed = parseDateTimeLocalValue(nextValue);

        if (parsed !== null) {
          onChangeValue(parsed);
        }
      }}
      disabled={!editable}
    />
  );
}
