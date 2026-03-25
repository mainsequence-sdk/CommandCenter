import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

import {
  fetchSimpleTableSchemaGraph,
  formatMainSequenceError,
} from "../../../../common/api";
import { MainSequenceSimpleTableUmlExplorer } from "./MainSequenceSimpleTableUmlExplorer";

const depthOptions = [1, 2, 3, 4, 5];

export function MainSequenceSimpleTableSchemaGraph({
  simpleTableId,
}: {
  simpleTableId: number;
}) {
  const [depth, setDepth] = useState("2");
  const [includeIncoming, setIncludeIncoming] = useState(false);
  const schemaGraphQuery = useQuery({
    queryKey: [
      "main_sequence",
      "simple_tables",
      "schema_graph",
      simpleTableId,
      depth,
      includeIncoming,
    ],
    queryFn: () =>
      fetchSimpleTableSchemaGraph(simpleTableId, {
        depth: Number(depth),
        includeIncoming,
      }),
    enabled: simpleTableId > 0,
  });

  const error = schemaGraphQuery.isError ? formatMainSequenceError(schemaGraphQuery.error) : null;
  const payload = schemaGraphQuery.data;

  return (
    <Card variant="nested">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4 text-primary" />
              ULM diagram
            </CardTitle>
            <CardDescription>
              UML-style schema view for the selected simple table, including columns, indexes, and
              foreign-key multiplicities.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/28 px-3 py-2 text-sm text-muted-foreground">
              <span>Depth</span>
              <Select
                className="h-8 w-[84px] border-border/70 bg-background/60 text-sm"
                value={depth}
                onChange={(event) => setDepth(event.target.value)}
              >
                {depthOptions.map((option) => (
                  <option key={option} value={String(option)}>
                    {option}
                  </option>
                ))}
              </Select>
            </label>

            <div className="flex items-center gap-2 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/28 px-2 py-2">
              <Button
                variant={includeIncoming ? "default" : "outline"}
                size="sm"
                aria-pressed={includeIncoming}
                onClick={() => setIncludeIncoming((currentValue) => !currentValue)}
              >
                Include incoming
              </Button>
              <Badge variant={includeIncoming ? "success" : "neutral"}>
                {includeIncoming ? "ON" : "OFF"}
              </Badge>
            </div>

            <Badge variant="neutral">
              {payload?.tables.length ?? 0} table{(payload?.tables.length ?? 0) === 1 ? "" : "s"}
            </Badge>
            <Badge variant="neutral">
              {payload?.relationships.length ?? 0} relation
              {(payload?.relationships.length ?? 0) === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <MainSequenceSimpleTableUmlExplorer
          error={error}
          isLoading={schemaGraphQuery.isLoading}
          payload={payload}
        />
      </CardContent>
    </Card>
  );
}
