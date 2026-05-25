import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { fetchDataNodeDetail, formatMainSequenceError, listLocalTimeSeries } from "../../../../common/api";
import {
  normalizeDependencyGraphDirection,
  normalizeDependencyGraphSelectedId,
  type MainSequenceDependencyGraphWidgetProps,
} from "./dependencyGraphRuntime";
import { DataNodeQuickSearchPicker } from "../data-node-shared/DataNodeQuickSearchPicker";

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
  const direction = normalizeDependencyGraphDirection(draftProps.direction);
  const dataNodeUid = normalizeDependencyGraphSelectedId(draftProps.dataNodeUid) || undefined;
  const selectedDataNodeQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "dependency_graph_widget",
      "data_node",
      "detail",
      dataNodeUid,
    ],
    queryFn: () => fetchDataNodeDetail(dataNodeUid!),
    enabled: Boolean(dataNodeUid),
    staleTime: 300_000,
  });
  const latestLocalTimeSerieQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "dependency_graph_widget",
      "data_node",
      dataNodeUid,
      "latest_local_time_serie",
    ],
    queryFn: async () => {
      const page = await listLocalTimeSeries(dataNodeUid!, { limit: 1, offset: 0 });
      return page.results[0] ?? null;
    },
    enabled: Boolean(dataNodeUid),
    staleTime: 300_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Dependency Graph</Badge>
        <span className="text-sm text-muted-foreground">
          Choose the Data Node, then inspect either upstream or downstream dependencies.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <span className="text-sm font-medium text-topbar-foreground">Source</span>
          <p className="text-sm text-muted-foreground">
            Data Nodes are selected through the standard Dynamic Table quick search, then resolved to
            their latest linked LocalTimeSerie dependency graph.
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
        <span className="text-sm font-medium text-topbar-foreground">Data Node</span>
        <DataNodeQuickSearchPicker
          value={dataNodeUid}
          onChange={(nextId) => {
            onDraftPropsChange({
              ...draftProps,
              dataNodeUid: nextId,
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
      </label>

      {dataNodeUid ? (
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
                {latestLocalTimeSerieQuery.data.update_hash || latestLocalTimeSerieQuery.data.uid}
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
