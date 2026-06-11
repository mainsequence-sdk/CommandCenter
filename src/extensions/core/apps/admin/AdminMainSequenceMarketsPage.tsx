import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Loader2, LineChart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { updateConnectionInstance } from "@/connections/api";
import { useConnectionInstances } from "@/connections/hooks";
import type { ConnectionId, ConnectionInstance, ConnectionStatus } from "@/connections/types";
import {
  clearMainSequenceMarketsApiConnectionSessionCache,
  isMainSequenceMarketsApiConnection,
  MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE,
  MAIN_SEQUENCE_MARKETS_API_CONNECTION_TYPE_ID,
  MAIN_SEQUENCE_MARKETS_APP_ID,
} from "../../../../../extensions/main_sequence/common/connectionBindings";

import { AdminSurfaceLayout } from "./shared";

const unconfiguredConnectionValue = "__unconfigured__";

const mainSequenceMarketsBinding = {
  appId: MAIN_SEQUENCE_MARKETS_APP_ID,
  role: MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE,
};

type ConnectionBindingUpdate = {
  id: ConnectionId;
  publicConfig: Record<string, unknown>;
};

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The Main Sequence Markets binding update failed.";
}

function formatConnectionId(id: ConnectionId) {
  return String(id);
}

function sameConnectionId(left: ConnectionId, right: string) {
  return formatConnectionId(left) === right;
}

function readConnectionName(connection: ConnectionInstance) {
  return connection.name?.trim() || `Connection ${formatConnectionId(connection.id)}`;
}

function readTransportMode(connection: ConnectionInstance) {
  return connection.publicConfig.transportMode === "direct" ? "Direct debug" : "Backend proxy";
}

function hasCompiledContract(connection: ConnectionInstance) {
  const compiledContract = connection.publicConfig.compiledContract;
  return Boolean(compiledContract) && typeof compiledContract === "object";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMainSequenceMarketsBinding(value: unknown) {
  return (
    isRecord(value) &&
    value.appId === MAIN_SEQUENCE_MARKETS_APP_ID &&
    value.role === MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE
  );
}

function readApplicationBindings(publicConfig: Record<string, unknown>) {
  return Array.isArray(publicConfig.applicationBindings)
    ? publicConfig.applicationBindings
    : [];
}

function removeMainSequenceMarketsBinding(publicConfig: Record<string, unknown>) {
  return {
    ...publicConfig,
    applicationBindings: readApplicationBindings(publicConfig).filter(
      (binding) => !isMainSequenceMarketsBinding(binding),
    ),
  };
}

function addMainSequenceMarketsBinding(publicConfig: Record<string, unknown>) {
  const withoutMarketsBinding = removeMainSequenceMarketsBinding(publicConfig);

  return {
    ...withoutMarketsBinding,
    applicationBindings: [
      ...readApplicationBindings(withoutMarketsBinding),
      mainSequenceMarketsBinding,
    ],
  };
}

function statusVariant(status: ConnectionStatus) {
  if (status === "ok") {
    return "success" as const;
  }

  if (status === "error") {
    return "danger" as const;
  }

  if (status === "disabled") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export function AdminMainSequenceMarketsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const connectionsQuery = useConnectionInstances();
  const [selectedConnectionId, setSelectedConnectionId] = useState(unconfiguredConnectionValue);

  const adapterConnections = useMemo(
    () =>
      (connectionsQuery.data ?? [])
        .filter((connection) => connection.typeId === MAIN_SEQUENCE_MARKETS_API_CONNECTION_TYPE_ID)
        .sort((left, right) => readConnectionName(left).localeCompare(readConnectionName(right))),
    [connectionsQuery.data],
  );
  const boundConnections = useMemo(
    () => adapterConnections.filter(isMainSequenceMarketsApiConnection),
    [adapterConnections],
  );
  const selectedConnection = useMemo(
    () =>
      adapterConnections.find((connection) =>
        sameConnectionId(connection.id, selectedConnectionId),
      ) ?? null,
    [adapterConnections, selectedConnectionId],
  );
  const hasDuplicateBindings = boundConnections.length > 1;

  useEffect(() => {
    if (!connectionsQuery.data) {
      return;
    }

    setSelectedConnectionId((current) => {
      if (
        current !== unconfiguredConnectionValue &&
        adapterConnections.some((connection) => sameConnectionId(connection.id, current))
      ) {
        return current;
      }

      return boundConnections[0]
        ? formatConnectionId(boundConnections[0].id)
        : unconfiguredConnectionValue;
    });
  }, [adapterConnections, boundConnections, connectionsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedId =
        selectedConnectionId === unconfiguredConnectionValue ? null : selectedConnectionId;
      const updates = adapterConnections
        .map((connection): ConnectionBindingUpdate | null => {
          const shouldBeBound = selectedId !== null && sameConnectionId(connection.id, selectedId);
          const isBound = isMainSequenceMarketsApiConnection(connection);

          if (shouldBeBound === isBound) {
            return null;
          }

          return {
            id: connection.id,
            publicConfig: shouldBeBound
              ? addMainSequenceMarketsBinding(connection.publicConfig)
              : removeMainSequenceMarketsBinding(connection.publicConfig),
          };
        })
        .filter((update): update is ConnectionBindingUpdate => update !== null);

      await Promise.all(
        updates.map((update) =>
          updateConnectionInstance(update.id, {
            publicConfig: update.publicConfig,
          }),
        ),
      );

      return updates.length;
    },
    onSuccess: async () => {
      clearMainSequenceMarketsApiConnectionSessionCache();
      await queryClient.invalidateQueries({ queryKey: ["connections", "instances"] });
      toast({
        title: "Main Sequence Markets updated",
        description: "The organization API connection binding was saved.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to save binding",
        description: formatAdminError(error),
        variant: "error",
      });
    },
  });

  return (
    <AdminSurfaceLayout
      title="Main Sequence Markets"
      description="Organization API connection binding for the Markets application."
    >
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-primary" />
                Main Sequence Markets
              </CardTitle>
              <CardDescription>
                Select the Adapter From API connection used by the Markets application.
              </CardDescription>
            </div>
            {selectedConnection ? (
              <Badge variant={hasDuplicateBindings ? "warning" : "success"}>
                {hasDuplicateBindings ? "Duplicate bindings" : "Configured"}
              </Badge>
            ) : (
              <Badge variant="warning">Not configured</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {connectionsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading connections
            </div>
          ) : null}

          {connectionsQuery.error ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatAdminError(connectionsQuery.error)}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Bound data source
              </span>
              <Select
                value={selectedConnectionId}
                disabled={connectionsQuery.isLoading || adapterConnections.length === 0}
                onChange={(event) => setSelectedConnectionId(event.target.value)}
              >
                <option value={unconfiguredConnectionValue}>Not configured</option>
                {adapterConnections.map((connection) => (
                  <option
                    key={formatConnectionId(connection.id)}
                    value={formatConnectionId(connection.id)}
                  >
                    {readConnectionName(connection)}
                  </option>
                ))}
              </Select>
            </label>

            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/30 px-4 py-3">
              <div className="text-xs font-medium text-muted-foreground">Current binding</div>
              {selectedConnection ? (
                <div className="mt-2 space-y-2">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {readConnectionName(selectedConnection)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(selectedConnection.status)}>
                      {selectedConnection.status}
                    </Badge>
                    <Badge variant="secondary">{readTransportMode(selectedConnection)}</Badge>
                    <Badge variant={hasCompiledContract(selectedConnection) ? "success" : "warning"}>
                      {hasCompiledContract(selectedConnection) ? "Contract" : "No contract"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">No connection selected.</div>
              )}
            </div>
          </div>

          {adapterConnections.length === 0 && !connectionsQuery.isLoading ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
              Create an Adapter From API connection before binding Main Sequence Markets.
            </div>
          ) : null}

          {hasDuplicateBindings ? (
            <div className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Duplicate Main Sequence Markets bindings</div>
                <div className="mt-1">
                  {boundConnections.map(readConnectionName).join(", ")}
                </div>
                <div className="mt-1">Saving keeps only the selected data source bound.</div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center">
            <Button
              type="button"
              disabled={connectionsQuery.isLoading || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Save binding
            </Button>
            <span className="text-xs text-muted-foreground">
              The selection is stored on the connection public config.
            </span>
          </div>
        </CardContent>
      </Card>
    </AdminSurfaceLayout>
  );
}
