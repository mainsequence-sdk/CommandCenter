import { useMemo } from "react";

import { json } from "@codemirror/lang-json";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { useQuery } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { BarChart3, Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  fetchDataNodeStats,
  formatMainSequenceError,
} from "../../../../common/api";

const statsEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    fontSize: "0.75rem",
    lineHeight: "1.5rem",
    padding: "0.75rem 0.5rem",
  },
  ".cm-gutters": {
    backgroundColor: "color-mix(in srgb, var(--muted) 24%, transparent)",
    borderRight: "1px solid color-mix(in srgb, var(--border) 70%, transparent)",
    color: "var(--muted-foreground)",
  },
  ".cm-line": {
    padding: "0 0.625rem",
  },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    minHeight: "440px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--primary) 28%, transparent) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--muted) 18%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--muted) 24%, transparent)",
    color: "var(--foreground)",
  },
});

function formatStatsJson(value: unknown) {
  return JSON.stringify(
    value ?? {
      multi_index_stats: {},
      multi_index_column_stats: {},
    },
    null,
    2,
  );
}

function countObjectKeys(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;
}

export function MainSequenceDataNodeStatsTab({
  dataNodeUid,
}: {
  dataNodeUid: string;
}) {
  const statsQuery = useQuery({
    queryKey: ["main_sequence", "data_nodes", "stats", dataNodeUid],
    queryFn: () => fetchDataNodeStats(dataNodeUid),
    enabled: Boolean(String(dataNodeUid).trim()),
  });
  const editorExtensions = useMemo(
    () => [
      statsEditorTheme,
      json(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ],
    [],
  );
  const statsJson = useMemo(() => formatStatsJson(statsQuery.data), [statsQuery.data]);
  const multiIndexStatsKeyCount = countObjectKeys(statsQuery.data?.multi_index_stats);
  const multiIndexColumnStatsKeyCount = countObjectKeys(statsQuery.data?.multi_index_column_stats);

  return (
    <Card variant="nested">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Stats
            </CardTitle>
            <CardDescription>
              Dynamic table stats returned by the DataNode get-stats endpoint.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`${multiIndexStatsKeyCount} stats keys`}</Badge>
            <Badge variant="neutral">{`${multiIndexColumnStatsKeyCount} column stats keys`}</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void statsQuery.refetch();
              }}
              disabled={statsQuery.isFetching}
            >
              {statsQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {statsQuery.isLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading data node stats
            </div>
          </div>
        ) : null}

        {statsQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(statsQuery.error)}
          </div>
        ) : null}

        {!statsQuery.isLoading && !statsQuery.isError ? (
          <div
            className="overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50"
            data-no-widget-drag="true"
          >
            <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 px-3 py-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
                JSON
              </span>
              <span className="max-w-full truncate font-mono text-[11px] text-muted-foreground sm:max-w-[min(520px,50vw)]">
                /orm/api/ts_manager/dynamic_table/{dataNodeUid}/get-stats/
              </span>
            </div>
            <CodeMirror
              value={statsJson}
              readOnly
              editable={false}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                autocompletion: false,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                highlightSelectionMatches: true,
                searchKeymap: true,
                lintKeymap: false,
              }}
              extensions={editorExtensions}
              theme="none"
              minHeight="440px"
              aria-label="Data node stats JSON"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
