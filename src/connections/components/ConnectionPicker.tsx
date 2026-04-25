import { useEffect, useMemo, useRef, useState } from "react";

import { getConnectionRuntimeDefinition } from "@/app/registry/connection-runtime";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConnectionTypeIcon } from "@/connections/components/ConnectionTypeIcon";
import { useConnectionInstances, useConnectionTypes } from "@/connections/hooks";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import type {
  AnyConnectionTypeDefinition,
  ConnectionCapability,
  ConnectionInstance,
  ConnectionRef,
} from "@/connections/types";
import type { WidgetContractId } from "@/widgets/types";

interface ConnectionPickerAccepts {
  typeIds?: string[];
  capabilities?: ConnectionCapability[];
  outputContracts?: WidgetContractId[];
}

export interface ConnectionPickerProps {
  value?: ConnectionRef;
  onChange: (value: ConnectionRef | undefined) => void;
  accepts?: ConnectionPickerAccepts;
  disabled?: boolean;
  placeholder?: string;
}

function instanceMatchesAccepts(
  instance: ConnectionInstance,
  connectionType: AnyConnectionTypeDefinition | undefined,
  accepts?: ConnectionPickerAccepts,
) {
  if (!accepts) {
    return true;
  }

  if (accepts.typeIds?.length && !accepts.typeIds.includes(instance.typeId)) {
    return false;
  }

  if (
    accepts.capabilities?.length &&
    !accepts.capabilities.every((capability) => connectionType?.capabilities.includes(capability))
  ) {
    return false;
  }

  if (
    accepts.outputContracts?.length &&
    !connectionType?.queryModels?.some((model) =>
      model.outputContracts.some((contract) => accepts.outputContracts?.includes(contract)),
    )
  ) {
    return false;
  }

  return true;
}

function formatConnectionStatus(instance: ConnectionInstance) {
  if (instance.status === "ok") return "Healthy";
  if (instance.status === "error") return "Error";
  if (instance.status === "disabled") return "Disabled";
  return "Unknown";
}

function getConnectionIconUrl(connection: AnyConnectionTypeDefinition | undefined) {
  if (!connection) {
    return undefined;
  }

  return connection.iconUrl ?? getConnectionRuntimeDefinition(connection)?.iconUrl;
}

function getTypeForInstance(
  instance: ConnectionInstance,
  typesById: Map<string, AnyConnectionTypeDefinition>,
) {
  return typesById.get(instance.typeId) ?? getConnectionRuntimeDefinition(instance.typeId);
}

function getSearchText(
  instance: ConnectionInstance,
  connectionType: AnyConnectionTypeDefinition | undefined,
) {
  return [
    instance.name,
    instance.uid,
    instance.typeId,
    connectionType?.title ?? "",
    connectionType?.category ?? "",
    ...(instance.tags ?? []),
  ].join(" ").toLowerCase();
}

export function ConnectionPicker({
  value,
  onChange,
  accepts,
  disabled,
  placeholder = "Select a connection",
}: ConnectionPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousValueRef = useRef(value?.uid ?? "");
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const instancesQuery = useConnectionInstances();
  const typesQuery = useConnectionTypes();
  const typesById = useMemo(
    () => new Map((typesQuery.data ?? []).map((connection) => [connection.id, connection])),
    [typesQuery.data],
  );
  const instances = useMemo(
    () =>
      (instancesQuery.data ?? [])
        .filter((instance) =>
          instanceMatchesAccepts(instance, getTypeForInstance(instance, typesById), accepts),
        )
        .sort((left, right) => {
          if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1;
          }

          return left.name.localeCompare(right.name);
        }),
    [accepts, instancesQuery.data, typesById],
  );
  const selectedUid = value?.uid ?? "";
  const selectedInstance = instances.find((instance) => instance.uid === selectedUid);
  const selectedType = selectedInstance
    ? getTypeForInstance(selectedInstance, typesById)
    : undefined;
  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredInstances = normalizedSearch
    ? instances.filter((instance) =>
        getSearchText(instance, getTypeForInstance(instance, typesById)).includes(normalizedSearch),
      )
    : instances;
  const loading = instancesQuery.isLoading || typesQuery.isLoading;

  useEffect(() => {
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

  useEffect(() => {
    if (open && previousValueRef.current !== selectedUid) {
      setOpen(false);
    }

    previousValueRef.current = selectedUid;
  }, [open, selectedUid]);

  return (
    <div className="space-y-2">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          className={cn(
            "flex min-h-12 w-full items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 px-3 py-2 text-left text-sm text-foreground shadow-sm outline-none transition-colors hover:border-primary/35 hover:bg-muted/25 focus:border-primary/70 focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-primary/60 bg-muted/35",
          )}
          disabled={disabled || loading || instances.length === 0}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => {
            if (!disabled && instances.length > 0) {
              setOpen((current) => !current);
            }
          }}
        >
          <span className="flex min-w-0 items-center gap-3">
            {selectedInstance ? (
              <ConnectionTypeIcon
                title={selectedType?.title ?? selectedInstance.typeId}
                iconUrl={getConnectionIconUrl(selectedType)}
                className="h-8 w-8"
              />
            ) : null}
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate",
                  selectedInstance ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {loading ? "Loading connections" : selectedInstance?.name ?? placeholder}
              </span>
              {selectedInstance ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {selectedType?.title ?? selectedInstance.typeId} · {selectedInstance.typeId}
                </span>
              ) : null}
            </span>
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
          <div
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-50 overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border/80 bg-card/96 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
          >
            <div className="border-b border-border/70 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search connections"
                  className="h-10 border-border/70 bg-background/55 pl-9"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredInstances.length === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] px-3 py-8 text-sm text-muted-foreground">
                  No matching connections.
                </div>
              ) : null}

              {filteredInstances.map((instance) => {
                const selected = instance.uid === selectedUid;
                const connectionType = getTypeForInstance(instance, typesById);

                return (
                  <button
                    key={instance.uid}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[calc(var(--radius)-6px)] px-3 py-2.5 text-left transition-colors hover:bg-muted/45",
                      selected && "bg-primary/12 text-topbar-foreground",
                    )}
                    onClick={() => {
                      onChange({ uid: instance.uid, typeId: instance.typeId });
                      setOpen(false);
                    }}
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <ConnectionTypeIcon
                      title={connectionType?.title ?? instance.typeId}
                      iconUrl={getConnectionIconUrl(connectionType)}
                      className="h-9 w-9"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {instance.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {connectionType?.title ?? instance.typeId} · {instance.typeId}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant={instance.status === "ok" ? "primary" : "neutral"}>
                          {formatConnectionStatus(instance)}
                        </Badge>
                        {instance.isDefault ? <Badge variant="neutral">Default</Badge> : null}
                        {instance.isSystem ? <Badge variant="neutral">System</Badge> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {selectedInstance ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ConnectionTypeIcon
            title={selectedType?.title ?? selectedInstance.typeId}
            iconUrl={getConnectionIconUrl(selectedType)}
            className="h-6 w-6"
          />
          <Badge variant="neutral">{selectedType?.title ?? selectedInstance.typeId}</Badge>
          <Badge variant={selectedInstance.status === "ok" ? "primary" : "neutral"}>
            {formatConnectionStatus(selectedInstance)}
          </Badge>
          {selectedInstance.isDefault ? <Badge variant="neutral">Default</Badge> : null}
          {selectedInstance.isSystem ? <Badge variant="neutral">System</Badge> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {instancesQuery.isError
            ? "Unable to load configured connections."
            : "Connection instances are backend-owned. A system default is used until managed instances exist."}
        </p>
      )}
    </div>
  );
}
