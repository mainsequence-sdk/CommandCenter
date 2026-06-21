import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { resolveRunConfigSelection } from "../runtime/run-config-selection";

type RunConfigSelection = ReturnType<typeof resolveRunConfigSelection>;

export function RunConfigFields({
  className,
  controlClassName,
  disabled = false,
  onModelChange,
  onProviderChange,
  onThinkingChange,
  selection,
}: {
  className?: string;
  controlClassName?: string;
  disabled?: boolean;
  onModelChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onThinkingChange: (value: string) => void;
  selection: RunConfigSelection;
}) {
  const controlClasses = cn("h-11 w-full bg-card/70", controlClassName);

  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)_minmax(0,0.75fr)]",
        className,
      )}
    >
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Provider</label>
        <Select
          aria-label="Provider"
          className={controlClasses}
          disabled={disabled || selection.providerOptions.length === 0}
          value={selection.effectiveProvider}
          onChange={(event) => {
            onProviderChange(event.target.value);
          }}
          searchable
          searchPlaceholder="Search providers"
        >
          {selection.providerOptions.length === 0 ? (
            <option value="">No providers available</option>
          ) : null}
          {selection.providerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Model</label>
        <Select
          aria-label="Model"
          className={controlClasses}
          disabled={disabled || selection.modelOptions.length === 0}
          value={selection.effectiveModelId}
          onChange={(event) => {
            onModelChange(event.target.value);
          }}
          searchable
          searchPlaceholder="Search models"
        >
          {selection.modelOptions.length === 0 ? (
            <option value="">No models available</option>
          ) : null}
          {selection.modelOptions.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Thinking</label>
        <Select
          aria-label="Thinking"
          className={controlClasses}
          disabled={disabled || selection.reasoningOptions.length === 0}
          value={selection.resolvedThinking}
          onChange={(event) => {
            onThinkingChange(event.target.value);
          }}
        >
          {selection.reasoningOptions.length === 0 ? (
            <option value="">No thinking options available</option>
          ) : null}
          {selection.reasoningOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
