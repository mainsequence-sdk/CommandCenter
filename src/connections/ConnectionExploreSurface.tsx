import { useEffect, useMemo, useState } from "react";

import { Search } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import {
  buildConnectionQueryDraftSeed,
  buildRelativeFixedRange,
  resolveConnectionAuthoringContract,
} from "@/connections/connectionAuthoringContract";
import type { ConnectionExploreProps } from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

const DEFAULT_EXPLORE_RANGE_MS = 365 * 24 * 60 * 60 * 1000;

export function ConnectionExploreSurface({
  connectionInstance,
  connectionType,
}: ConnectionExploreProps) {
  const authoringContract = resolveConnectionAuthoringContract(connectionType);
  const defaultRange = useMemo(
    () => buildRelativeFixedRange(DEFAULT_EXPLORE_RANGE_MS),
    [connectionInstance.id],
  );
  const [queryProps, setQueryProps] = useState<ConnectionQueryWidgetProps>(() =>
    buildConnectionQueryDraftSeed({
      connectionInstance,
      connectionType,
    }),
  );

  useEffect(() => {
    setQueryProps(
      buildConnectionQueryDraftSeed({
        connectionInstance,
        connectionType,
      }),
    );
  }, [connectionInstance.id, connectionInstance.typeId, connectionType]);

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
      </CardContent>
    </Card>
  );
}
