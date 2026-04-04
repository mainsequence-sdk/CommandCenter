import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { fetchDataNodeDetail, formatMainSequenceError, listLocalTimeSeries } from "../../../../common/api";
import {
  normalizeDependencyGraphDirection,
  normalizeDependencyGraphSelectedId,
  normalizeDependencyGraphSourceKind,
  type MainSequenceDependencyGraphWidgetProps,
} from "./dependencyGraphRuntime";
import { DataNodeQuickSearchPicker } from "../data-node-shared/DataNodeQuickSearchPicker";
import { SimpleTableUpdateQuickSearchPicker } from "../data-node-shared/SimpleTableUpdateQuickSearchPicker";

function SourceToggleButton({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "outline"}
      disabled={disabled}
      className={cn(
        "h-8 rounded-full px-3 text-xs",
        active && "border-primary/40 bg-primary/15 text-topbar-foreground hover:bg-primary/20",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function MainSequenceDependencyGraphWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<MainSequenceDependencyGraphWidgetProps>) {
  const sourceKind = normalizeDependencyGraphSourceKind(draftProps.sourceKind);
  const direction = normalizeDependencyGraphDirection(draftProps.direction);
  const dataNodeId = normalizeDependencyGraphSelectedId(draftProps.dataNodeId) || undefined;
  const simpleTableUpdateId =
    normalizeDependencyGraphSelectedId(draftProps.simpleTableUpdateId) || undefined;
  const selectedDataNodeQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "dependency_graph_widget",
      "data_node",
      "detail",
      dataNodeId,
    ],
    queryFn: () => fetchDataNodeDetail(dataNodeId ?? 0),
    enabled: sourceKind === "data_node" && Number.isFinite(dataNodeId) && (dataNodeId ?? 0) > 0,
    staleTime: 300_000,
  });
  const latestLocalTimeSerieQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "dependency_graph_widget",
      "data_node",
      dataNodeId,
      "latest_local_time_serie",
    ],
    queryFn: async () => {
      const page = await listLocalTimeSeries(dataNodeId ?? 0, { limit: 1, offset: 0 });
      return page.results[0] ?? null;
    },
    enabled: sourceKind === "data_node" && Number.isFinite(dataNodeId) && (dataNodeId ?? 0) > 0,
    staleTime: 300_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Dependency Graph</Badge>
        <span className="text-sm text-muted-foreground">
          Choose the update source, then inspect either upstream or downstream dependencies.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Source type</span>
          <div className="flex flex-wrap gap-2">
            <SourceToggleButton
              active={sourceKind === "data_node"}
              disabled={!editable}
              onClick={() => {
                onDraftPropsChange({
                  ...draftProps,
                  sourceKind: "data_node",
                  simpleTableUpdateId: undefined,
                });
              }}
            >
              Data Nodes
            </SourceToggleButton>
            <SourceToggleButton
              active={sourceKind === "simple_table"}
              disabled={!editable}
              onClick={() => {
                onDraftPropsChange({
                  ...draftProps,
                  sourceKind: "simple_table",
                  dataNodeId: undefined,
                });
              }}
            >
              Simple Tables
            </SourceToggleButton>
          </div>
          <p className="text-sm text-muted-foreground">
            Data Nodes are selected through the standard Dynamic Table quick search, then resolved to
            their latest linked `local_time_serie` dependency graph. Simple Tables use
            `simple_table_update` dependency graphs.
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Direction</span>
          <div className="flex flex-wrap gap-2">
            <SourceToggleButton
              active={direction === "downstream"}
              disabled={!editable}
              onClick={() => {
                onDraftPropsChange({
                  ...draftProps,
                  direction: "downstream",
                });
              }}
            >
              Downstream
            </SourceToggleButton>
            <SourceToggleButton
              active={direction === "upstream"}
              disabled={!editable}
              onClick={() => {
                onDraftPropsChange({
                  ...draftProps,
                  direction: "upstream",
                });
              }}
            >
              Upstream
            </SourceToggleButton>
          </div>
          <p className="text-sm text-muted-foreground">
            Downstream follows impacted dependents. Upstream shows source dependencies.
          </p>
        </div>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-topbar-foreground">
          {sourceKind === "simple_table" ? "Simple Table update" : "Data Node"}
        </span>
        {sourceKind === "simple_table" ? (
          <SimpleTableUpdateQuickSearchPicker
            value={simpleTableUpdateId}
            onChange={(nextId) => {
              onDraftPropsChange({
                ...draftProps,
                sourceKind,
                simpleTableUpdateId: nextId,
              });
            }}
            editable={editable}
            queryScope="dependency_graph_widget"
            placeholder="Select a simple table update"
            searchPlaceholder="Search simple table updates"
            selectionHelpText="Choose the simple table update you want to inspect."
          />
        ) : (
          <DataNodeQuickSearchPicker
            value={dataNodeId}
            onChange={(nextId) => {
              onDraftPropsChange({
                ...draftProps,
                sourceKind,
                dataNodeId: nextId,
              });
            }}
            editable={editable}
            queryScope="dependency_graph_widget"
            selectedDataNode={selectedDataNodeQuery.data}
            detailError={selectedDataNodeQuery.error}
            placeholder="Select a data node"
            searchPlaceholder="Search data nodes"
            selectionHelpText="Choose the data node whose latest linked update should drive the dependency graph."
          />
        )}
      </label>

      {sourceKind === "data_node" && dataNodeId ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-sm text-muted-foreground">
          {latestLocalTimeSerieQuery.isLoading ? (
            <span>Resolving the latest LocalTimeSerie update linked to this Data Node.</span>
          ) : latestLocalTimeSerieQuery.isError ? (
            <span className="text-danger">
              {formatMainSequenceError(latestLocalTimeSerieQuery.error)}
            </span>
          ) : latestLocalTimeSerieQuery.data ? (
            <span>
              The graph will use LocalTimeSerie update{" "}
              <span className="font-medium text-foreground">
                {latestLocalTimeSerieQuery.data.update_hash || latestLocalTimeSerieQuery.data.id}
              </span>
              .
            </span>
          ) : (
            <span>No linked LocalTimeSerie updates were found for this Data Node.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
