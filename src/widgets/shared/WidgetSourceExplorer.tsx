import { useEffect, useMemo, useRef, useState } from "react";

import { Check, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  applyWidgetBindingTransform,
  listWidgetValueDescriptorPaths,
  type WidgetValuePathOption,
} from "@/dashboards/widget-binding-transforms";
import { cn } from "@/lib/utils";
import type {
  WidgetContractId,
  WidgetPortBinding,
  WidgetValueDescriptor,
} from "@/widgets/types";

export interface WidgetSourceExplorerOutputOption {
  id: string;
  label: string;
  contract: WidgetContractId;
  description?: string;
  value?: unknown;
  valueDescriptor?: WidgetValueDescriptor;
}

export interface WidgetSourceExplorerWidgetOption {
  id: string;
  label: string;
  title: string;
  widgetTypeLabel: string;
  instanceLabel: string;
  outputs: WidgetSourceExplorerOutputOption[];
}

type WidgetSourceExplorerEvaluation = {
  status:
    | "valid"
    | "unbound"
    | "missing-source"
    | "missing-output"
    | "contract-mismatch"
    | "transform-invalid"
    | "pending";
  message: string;
  contractId?: WidgetContractId;
  value?: unknown;
};

const maxBindingPreviewLines = 100;

function isStructuredOutput(option: WidgetSourceExplorerOutputOption | undefined) {
  return option?.valueDescriptor?.kind === "object" || option?.valueDescriptor?.kind === "array";
}

function cropBindingPreviewLines(value: string) {
  const lines = value.split(/\r?\n/);

  if (lines.length <= maxBindingPreviewLines) {
    return value;
  }

  return `${lines.slice(0, maxBindingPreviewLines).join("\n")}\n… (${lines.length - maxBindingPreviewLines} more lines hidden)`;
}

function formatBindingPreviewValue(value: unknown) {
  if (value === undefined) {
    return "No value available.";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return cropBindingPreviewLines(value);
  }

  try {
    return cropBindingPreviewLines(JSON.stringify(value, null, 2));
  } catch {
    return cropBindingPreviewLines(String(value));
  }
}

function resolveDraftBindingStatusVariant(
  status: WidgetSourceExplorerEvaluation["status"],
) {
  switch (status) {
    case "valid":
      return "success";
    case "contract-mismatch":
    case "transform-invalid":
      return "danger";
    case "missing-source":
    case "missing-output":
      return "warning";
    case "pending":
    case "unbound":
    default:
      return "neutral";
  }
}

function buildBindingMappingSummary(
  inputLabel: string,
  sourceOutputLabel: string | undefined,
  transformId: string,
  transformPath: string[] | undefined,
) {
  if (!sourceOutputLabel) {
    return "No mapping selected";
  }

  if (transformId === "extract-path" && transformPath && transformPath.length > 0) {
    return `${sourceOutputLabel}.${transformPath.join(".")} -> ${inputLabel}`;
  }

  return `${sourceOutputLabel} -> ${inputLabel}`;
}

function formatValueDescriptorType(
  descriptor: WidgetValueDescriptor | undefined,
): string {
  if (!descriptor) {
    return "Unknown";
  }

  switch (descriptor.kind) {
    case "primitive":
      return descriptor.format ? `${descriptor.primitive} (${descriptor.format})` : descriptor.primitive;
    case "object":
      return "object";
    case "array":
      if (!descriptor.items) {
        return "array";
      }

      return `array<${formatValueDescriptorType(descriptor.items)}>`;
    case "unknown":
    default:
      return "json";
  }
}

function buildPathKey(path: string[] | undefined) {
  return (path ?? []).join(".");
}

function resolvePathOptionLabel(option: WidgetValuePathOption) {
  return option.label.split(" / ").at(-1) ?? option.label;
}

function updateBindingTransform(
  binding: WidgetPortBinding,
  options: {
    transformId?: string;
    transformPath?: string[];
    transformContractId?: WidgetContractId;
  },
): WidgetPortBinding {
  return {
    sourceWidgetId: binding.sourceWidgetId,
    sourceOutputId: binding.sourceOutputId,
    transformId: options.transformId,
    transformPath: options.transformPath,
    transformContractId: options.transformContractId,
  };
}

function buildSourceWidgetMetaLabel(option: WidgetSourceExplorerWidgetOption) {
  return `${option.widgetTypeLabel} · ${option.instanceLabel}`;
}

function SourceWidgetSelect({
  disabled,
  options,
  value,
  onChange,
}: {
  disabled?: boolean;
  options: WidgetSourceExplorerWidgetOption[];
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  useEffect(() => {
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

  const selectedMetaLabel = selectedOption ? buildSourceWidgetMetaLabel(selectedOption) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex min-h-14 w-full items-start justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2.5 text-left shadow-sm outline-none transition-colors hover:border-primary/35 hover:bg-muted/25 focus:border-primary/70 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-primary/60 bg-muted/35",
        )}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
      >
        <span className="min-w-0 flex-1">
          {selectedOption ? (
            <span className="block min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {selectedOption.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {selectedMetaLabel}
              </span>
            </span>
          ) : (
            <span className="block pt-1 text-sm text-muted-foreground">No widget selected</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute top-[calc(100%+0.5rem)] left-0 right-0 z-40 overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 p-1.5 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
        >
          <div className="max-h-80 overflow-y-auto">
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              className={cn(
                "flex w-full items-start gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2.5 text-left transition-colors hover:bg-muted/45",
                value === "" && "bg-primary/12 text-topbar-foreground",
              )}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center pt-0.5 text-primary">
                {value === "" ? <Check className="h-4 w-4" /> : null}
              </span>
              <span className="block min-w-0">
                <span className="block text-sm font-medium text-foreground">No widget selected</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Clear the current source selection
                </span>
              </span>
            </button>

            {options.map((option) => {
              const selected = option.id === value;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2.5 text-left transition-colors hover:bg-muted/45",
                    selected && "bg-primary/12 text-topbar-foreground",
                  )}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center pt-0.5 text-primary">
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.widgetTypeLabel}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground/90">
                      {option.instanceLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface WidgetSourceExplorerProps {
  acceptedContracts: WidgetContractId[];
  editable?: boolean;
  inputLabel: string;
  onBindingChange: (binding: WidgetPortBinding | undefined) => void;
  onSelectedSourceWidgetIdChange: (sourceWidgetId: string) => void;
  selectedSourceWidgetId: string;
  sourceWidgets: WidgetSourceExplorerWidgetOption[];
  value?: WidgetPortBinding;
}

export function WidgetSourceExplorer({
  acceptedContracts,
  editable,
  inputLabel,
  onBindingChange,
  onSelectedSourceWidgetIdChange,
  selectedSourceWidgetId,
  sourceWidgets,
  value,
}: WidgetSourceExplorerProps) {
  const selectedSourceWidget = useMemo(
    () => sourceWidgets.find((option) => option.id === selectedSourceWidgetId),
    [selectedSourceWidgetId, sourceWidgets],
  );
  const selectedOutputOptions = selectedSourceWidget?.outputs ?? [];
  const selectedOutput = useMemo(
    () => selectedOutputOptions.find((option) => option.id === value?.sourceOutputId),
    [selectedOutputOptions, value?.sourceOutputId],
  );
  const currentTransformId =
    value?.transformId === "extract-path" ? "extract-path" : "identity";
  const pathOptions = useMemo(
    () => listWidgetValueDescriptorPaths(selectedOutput?.valueDescriptor),
    [selectedOutput?.valueDescriptor],
  );
  const selectedPathKey = buildPathKey(value?.transformPath);
  const selectedPathOption = useMemo(
    () => pathOptions.find((option) => buildPathKey(option.path) === selectedPathKey),
    [pathOptions, selectedPathKey],
  );
  const transformedOutput = useMemo(
    () =>
      selectedOutput && value
        ? applyWidgetBindingTransform(value, {
            contractId: selectedOutput.contract,
            value: selectedOutput.value,
            valueDescriptor: selectedOutput.valueDescriptor,
          })
        : undefined,
    [selectedOutput, value],
  );
  const selectedOutputContractId =
    selectedOutput?.valueDescriptor?.contract ?? selectedOutput?.contract;
  const selectedOutputStructured = isStructuredOutput(selectedOutput);

  const evaluation: WidgetSourceExplorerEvaluation =
    !selectedSourceWidgetId
      ? {
          status: "unbound",
          message: "No mapping selected.",
          contractId: undefined,
          value: undefined,
        }
      : !selectedSourceWidget
        ? {
            status: "missing-source",
            message: "The selected source widget is no longer available.",
            contractId: undefined,
            value: undefined,
          }
        : !value?.sourceOutputId
          ? {
              status: "pending",
              message: "Choose a source output to continue.",
              contractId: undefined,
              value: undefined,
            }
          : !selectedOutput
            ? {
                status: "missing-output",
                message: "The selected source output is no longer available.",
                contractId: undefined,
                value: undefined,
              }
            : currentTransformId === "extract-path" &&
                (!value.transformPath || value.transformPath.length === 0)
              ? {
                  status: "pending",
                  message: "Choose a nested field to continue.",
                  contractId: selectedOutput.contract,
                  value: selectedOutput.value,
                }
              : !transformedOutput || transformedOutput.status !== "valid"
                ? {
                    status: "transform-invalid",
                    message:
                      currentTransformId === "extract-path"
                        ? "The selected nested path could not be resolved from this output."
                        : "The selected output could not be transformed.",
                    contractId: selectedOutput.contract,
                    value: selectedOutput.value,
                  }
                : acceptedContracts.includes(transformedOutput.contractId)
                  ? {
                      status: "valid",
                      message: `Compatible after ${currentTransformId === "extract-path" ? "nested field extraction" : "direct binding"}.`,
                      contractId: transformedOutput.contractId,
                      value: transformedOutput.value,
                    }
                  : {
                      status: "contract-mismatch",
                      message: `Incompatible. ${inputLabel} accepts ${acceptedContracts.join(", ")} but the current source resolves to ${transformedOutput.contractId}.`,
                      contractId: transformedOutput.contractId,
                      value: transformedOutput.value,
                    };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Source widget
          </label>
          <SourceWidgetSelect
            disabled={!editable}
            value={selectedSourceWidgetId}
            options={sourceWidgets}
            onChange={(nextSourceWidgetId) => {
              onSelectedSourceWidgetIdChange(nextSourceWidgetId);
              onBindingChange(undefined);
            }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Source output
          </label>
          <Select
            className={cn(!editable ? "cursor-not-allowed opacity-70" : undefined)}
            value={value?.sourceOutputId ?? ""}
            disabled={!editable || !selectedSourceWidget}
            onChange={(event) => {
              const nextSourceOutputId = event.target.value;
              const nextOutput = selectedSourceWidget?.outputs.find(
                (output) => output.id === nextSourceOutputId,
              );
              const nextOutputContractId =
                nextOutput?.valueDescriptor?.contract ?? nextOutput?.contract;
              const shouldDefaultToNestedPath =
                isStructuredOutput(nextOutput) &&
                !(nextOutputContractId
                  ? acceptedContracts.includes(nextOutputContractId)
                  : false);

              onBindingChange(
                selectedSourceWidget && nextSourceOutputId && nextOutput
                  ? {
                      sourceWidgetId: selectedSourceWidget.id,
                      sourceOutputId: nextSourceOutputId,
                      transformId: shouldDefaultToNestedPath ? "extract-path" : undefined,
                      transformPath: undefined,
                      transformContractId: undefined,
                    }
                  : undefined,
              );
            }}
          >
            <option value="">
              {selectedSourceWidget ? "Select an output" : "Choose a widget first"}
            </option>
            {selectedOutputOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>

          {selectedSourceWidget && selectedOutputOptions.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              This widget does not currently expose any outputs.
            </div>
          ) : null}

          {selectedOutput ? (
            <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-foreground">{selectedOutput.label}</div>
                <Badge variant="neutral">{formatValueDescriptorType(selectedOutput.valueDescriptor)}</Badge>
                {selectedOutputContractId ? (
                  <Badge variant="secondary">{selectedOutputContractId}</Badge>
                ) : null}
              </div>
              {selectedOutput.description ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedOutput.description}
                </div>
              ) : null}
              {isStructuredOutput(selectedOutput) ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Structured output. Choose whether to bind the whole output or drill into a nested field below.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {value?.sourceOutputId ? (
        <div className="space-y-3">
          {selectedOutputStructured ? (
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Value mapping
                </label>
                <Select
                  className={cn(!editable ? "cursor-not-allowed opacity-70" : undefined)}
                  value={currentTransformId}
                  disabled={!editable}
                  onChange={(event) => {
                    const nextTransformId = event.target.value;

                    onBindingChange(
                      value
                        ? updateBindingTransform(value, {
                            transformId:
                              nextTransformId === "extract-path" ? "extract-path" : undefined,
                            transformPath: undefined,
                            transformContractId: undefined,
                          })
                        : undefined,
                    );
                  }}
                >
                  <option value="identity">Use whole output</option>
                  <option value="extract-path" disabled={pathOptions.length === 0}>
                    Extract nested field
                  </option>
                </Select>
              </div>

              {currentTransformId === "extract-path" ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Nested field explorer
                  </label>
                  <div className="overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24">
                    {pathOptions.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">
                        This output does not expose any nested fields.
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto p-2">
                        <div className="space-y-2">
                          {pathOptions.map((option) => {
                            const optionKey = buildPathKey(option.path);
                            const selected = optionKey === selectedPathKey;
                            const optionCompatible = acceptedContracts.includes(option.contractId);

                            return (
                              <button
                                key={optionKey}
                                type="button"
                                disabled={!editable}
                                className={cn(
                                  "w-full rounded-[calc(var(--radius)-8px)] border px-3 py-2 text-left transition-colors",
                                  selected
                                    ? "border-primary/40 bg-primary/8"
                                    : "border-border/60 bg-background/36 hover:border-primary/25 hover:bg-muted/20",
                                  !editable ? "cursor-not-allowed opacity-70" : undefined,
                                )}
                                onClick={() => {
                                  onBindingChange(
                                    value
                                      ? updateBindingTransform(value, {
                                          transformId: "extract-path",
                                          transformPath: option.path,
                                          transformContractId: option.contractId,
                                        })
                                      : undefined,
                                  );
                                }}
                              >
                                <div
                                  className="space-y-1"
                                  style={{ paddingLeft: `${option.depth * 16}px` }}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-foreground">
                                      {resolvePathOptionLabel(option)}
                                    </span>
                                    <Badge variant={optionCompatible ? "secondary" : "warning"}>
                                      {formatValueDescriptorType(option.valueDescriptor)}
                                    </Badge>
                                    {option.required ? <Badge variant="warning">Required</Badge> : null}
                                  </div>
                                  <div className="font-mono text-[11px] text-muted-foreground">
                                    {option.path.join(".")}
                                  </div>
                                  {option.description ? (
                                    <div className="text-xs text-muted-foreground">
                                      {option.description}
                                    </div>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedPathOption ? (
                    <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-xs text-muted-foreground">
                      Selected path:{" "}
                      <span className="font-mono text-foreground">
                        {selectedPathOption.path.join(".")}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-sm">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Mapping
            </div>
            <div className="mt-1 font-medium text-foreground">
              {buildBindingMappingSummary(
                inputLabel,
                selectedOutput?.label,
                currentTransformId,
                value?.transformPath,
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={resolveDraftBindingStatusVariant(evaluation.status)}>
                {evaluation.status}
              </Badge>
              {evaluation.contractId ? <Badge variant="secondary">{evaluation.contractId}</Badge> : null}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{evaluation.message}</div>
          </div>

          <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-sm">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Preview
            </div>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground">
              {formatBindingPreviewValue(evaluation.value)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/18 px-3 py-2 text-sm">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Mapping
          </div>
          <div className="mt-1 font-medium text-foreground">No mapping selected</div>
          <div className="mt-1 text-xs text-muted-foreground">{evaluation.message}</div>
        </div>
      )}
    </div>
  );
}
