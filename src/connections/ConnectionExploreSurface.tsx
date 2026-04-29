import { useEffect, useMemo, useState } from "react";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import { ConnectionStreamQueryTestPanel } from "@/connections/ConnectionStreamQueryTestPanel";
import {
  buildConnectionQueryDraftSeed,
  buildRelativeFixedRange,
  resolveConnectionAuthoringContract,
  resolveConnectionStreamAuthoringCopy,
  resolveConnectionStreamAuthoringQueryModels,
} from "@/connections/connectionAuthoringContract";
import type { ConnectionExploreProps } from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";
import type { ConnectionStreamQueryWidgetProps } from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";

const DEFAULT_EXPLORE_RANGE_MS = 365 * 24 * 60 * 60 * 1000;
const exploreTransportOptions = [
  {
    id: "query",
    label: "HTTP query",
    description: "Run one request/response query through /query/.",
  },
  {
    id: "stream",
    label: "WS stream",
    description: "Open one live WebSocket subscription through /stream-query/.",
  },
] as const;

export function ConnectionExploreSurface({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const authoringContract = resolveConnectionAuthoringContract(connectionType);
  const streamCopy = resolveConnectionStreamAuthoringCopy(connectionType);
  const streamQueryModels = useMemo(
    () =>
      resolveConnectionStreamAuthoringQueryModels({
        connectionInstance,
        connectionType,
      }),
    [connectionInstance, connectionType],
  );
  const streamExploreAvailable = streamQueryModels.length > 0;
  const defaultRange = useMemo(
    () => buildRelativeFixedRange(DEFAULT_EXPLORE_RANGE_MS),
    [connectionInstance.id],
  );
  const [authoringMode, setAuthoringMode] = useState<"query" | "stream">("query");
  const [queryProps, setQueryProps] = useState<ConnectionQueryWidgetProps>(() =>
    buildConnectionQueryDraftSeed({
      connectionInstance,
      connectionType,
    }),
  );
  const [streamProps, setStreamProps] = useState<ConnectionStreamQueryWidgetProps>(() =>
    buildConnectionQueryDraftSeed({
      connectionInstance,
      connectionType,
      authoringMode: "stream",
    }) as ConnectionStreamQueryWidgetProps,
  );
  const selectedStreamQueryModel = streamProps.queryModelId
    ? streamQueryModels.find((model) => model.id === streamProps.queryModelId)
    : undefined;

  useEffect(() => {
    setQueryProps(
      buildConnectionQueryDraftSeed({
        connectionInstance,
        connectionType,
      }),
    );
    setStreamProps(
      buildConnectionQueryDraftSeed({
        connectionInstance,
        connectionType,
        authoringMode: "stream",
      }) as ConnectionStreamQueryWidgetProps,
    );
  }, [connectionInstance.id, connectionInstance.typeId, connectionType]);

  useEffect(() => {
    if (!streamExploreAvailable && authoringMode === "stream") {
      setAuthoringMode("query");
    }
  }, [authoringMode, streamExploreAvailable]);

  return (
    <Card className="relative z-0">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <CardTitle>{authoringContract?.exploreTitle ?? `${connectionType.title} Explore`}</CardTitle>
        </div>
        <CardDescription>
          {authoringContract?.exploreDescription ??
            "Build and run the same generated connection query request used by workspace source widgets."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {streamExploreAvailable ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Transport</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select whether Explore should execute one HTTP request or open one live WebSocket
                  subscription for this connection.
                </p>
              </div>
              <div className="inline-flex flex-wrap gap-2 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/35 p-1">
                {exploreTransportOptions.map((option) => {
                  const active = authoringMode === option.id;

                  return (
                    <Button
                      key={option.id}
                      type="button"
                      variant={active ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setAuthoringMode(option.id);
                      }}
                      className="justify-start"
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                {authoringMode === "stream"
                  ? "WS stream opens the backend /stream-query/ route and previews the normalized live frame emitted by the WebSocket bridge."
                  : "HTTP query runs the backend /query/ route once and previews the normalized response frame."}
              </div>
            </section>
          ) : null}

          {authoringMode === "stream" && streamExploreAvailable ? (
            <>
              <ConnectionQueryWorkbench
                authoringMode="stream"
                value={streamProps as ConnectionQueryWidgetProps}
                onChange={(nextValue) => {
                  setStreamProps(nextValue as ConnectionStreamQueryWidgetProps);
                }}
                editable
                connectionInstance={connectionInstance}
                connectionType={connectionType}
                fixedRangeFallback={{
                  rangeStartMs: streamProps.fixedStartMs ?? defaultRange.fixedStartMs,
                  rangeEndMs: streamProps.fixedEndMs ?? defaultRange.fixedEndMs,
                }}
                showConnectionPicker={false}
                autoSelectFirstQueryModel
                showIncrementalRefreshControls={false}
                showTestAction={false}
              />
              <ConnectionStreamQueryTestPanel
                editable
                value={streamProps}
                queryModel={selectedStreamQueryModel}
                runButtonLabel={streamCopy.runButtonLabel}
                resultTitle={streamCopy.resultTitle}
                resultDescription={streamCopy.resultDescription}
              />
            </>
          ) : (
            <ConnectionQueryWorkbench
              value={queryProps}
              onChange={setQueryProps}
              editable
              connectionInstance={connectionInstance}
              connectionType={connectionType}
              fixedRangeFallback={{
                rangeStartMs: queryProps.fixedStartMs ?? defaultRange.fixedStartMs,
                rangeEndMs: queryProps.fixedEndMs ?? defaultRange.fixedEndMs,
              }}
              showConnectionPicker={false}
              autoSelectFirstQueryModel
              runButtonLabel={authoringContract?.exploreRunButtonLabel ?? "Run query"}
              resultTitle={authoringContract?.exploreResultTitle ?? "Query result"}
              resultDescription={
                authoringContract?.exploreResultDescription ??
                "Preview of the normalized connection runtime frame."
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
