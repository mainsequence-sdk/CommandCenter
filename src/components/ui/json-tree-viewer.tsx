import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type JsonPathSegment = string | number;

export interface JsonTreeViewerHandle {
  collapseAll: () => void;
  expandAll: () => void;
}

interface JsonTreeViewerProps {
  ariaLabel?: string;
  className?: string;
  defaultExpandedDepth?: number;
  resetKey?: string | number | null;
  value: unknown;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isCollapsibleValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isJsonObject(value)) {
    return Object.keys(value).length > 0;
  }

  return false;
}

function encodePath(path: JsonPathSegment[]) {
  return JSON.stringify(path);
}

function collectExpandablePaths(value: unknown, path: JsonPathSegment[] = [], paths: string[] = []) {
  if (!isCollapsibleValue(value)) {
    return paths;
  }

  if (path.length > 0) {
    paths.push(encodePath(path));
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectExpandablePaths(entry, [...path, index], paths);
    });
    return paths;
  }

  if (isJsonObject(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      collectExpandablePaths(entry, [...path, key], paths);
    });
  }
  return paths;
}

function collectDefaultExpandedPaths(
  value: unknown,
  defaultExpandedDepth: number,
  path: JsonPathSegment[] = [],
  paths: string[] = [],
) {
  if (!isCollapsibleValue(value)) {
    return paths;
  }

  if (path.length > 0 && path.length < defaultExpandedDepth) {
    paths.push(encodePath(path));
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectDefaultExpandedPaths(entry, defaultExpandedDepth, [...path, index], paths);
    });
    return paths;
  }

  if (isJsonObject(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      collectDefaultExpandedPaths(entry, defaultExpandedDepth, [...path, key], paths);
    });
  }
  return paths;
}

function formatCollapsedSummary(value: unknown) {
  if (Array.isArray(value)) {
    return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  }

  if (isJsonObject(value)) {
    const keyCount = Object.keys(value).length;
    return `{${keyCount} key${keyCount === 1 ? "" : "s"}}`;
  }

  return String(value);
}

function renderPrimitiveValue(value: unknown): ReactNode {
  if (typeof value === "string") {
    return <span style={{ color: "var(--success)" }}>{JSON.stringify(value)}</span>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span style={{ color: "var(--warning)" }}>{String(value)}</span>;
  }

  if (value === null) {
    return <span style={{ color: "var(--warning)" }}>null</span>;
  }

  if (value === undefined) {
    return <span className="text-muted-foreground">undefined</span>;
  }

  return <span className="text-foreground">{JSON.stringify(value)}</span>;
}

function renderKeyLabel(key: JsonPathSegment) {
  if (typeof key === "number") {
    return <span className="text-muted-foreground">{key}</span>;
  }

  return <span className="text-primary">{JSON.stringify(key)}</span>;
}

export const JsonTreeViewer = forwardRef<JsonTreeViewerHandle, JsonTreeViewerProps>(
  function JsonTreeViewer(
    {
      ariaLabel = "JSON tree viewer",
      className,
      defaultExpandedDepth = 1,
      resetKey,
      value,
    },
    ref,
  ) {
    const allExpandablePaths = useMemo(() => collectExpandablePaths(value), [value]);
    const initialExpandedPaths = useMemo(
      () => new Set(collectDefaultExpandedPaths(value, defaultExpandedDepth)),
      [defaultExpandedDepth, value],
    );
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(initialExpandedPaths);

    useEffect(() => {
      setExpandedPaths(new Set(initialExpandedPaths));
    }, [initialExpandedPaths, resetKey]);

    function collapseAll() {
      setExpandedPaths(new Set());
    }

    function expandAll() {
      setExpandedPaths(new Set(allExpandablePaths));
    }

    function togglePath(pathId: string) {
      setExpandedPaths((current) => {
        const next = new Set(current);

        if (next.has(pathId)) {
          next.delete(pathId);
        } else {
          next.add(pathId);
        }

        return next;
      });
    }

    useImperativeHandle(
      ref,
      () => ({
        collapseAll,
        expandAll,
      }),
      [allExpandablePaths],
    );

    function renderNode(
      node: unknown,
      path: JsonPathSegment[],
      depth: number,
      isLast: boolean,
      keyLabel?: JsonPathSegment,
    ): ReactNode {
      const pathId = encodePath(path);
      const collapsible = isCollapsibleValue(node);
      const isRoot = path.length === 0;
      const isExpanded = isRoot || expandedPaths.has(pathId);
      const indentStyle = { paddingLeft: `${depth}rem` };
      const trailingComma = isLast ? null : (
        <span className="text-muted-foreground">,</span>
      );

      if (!collapsible) {
        return (
          <div
            key={pathId || "root"}
            className="flex items-start gap-2 px-3 py-0.5 font-mono text-xs leading-6"
            style={indentStyle}
          >
            {!isRoot ? <span className="h-3.5 w-3.5 shrink-0" /> : null}
            <div className="min-w-0 break-all">
              {keyLabel !== undefined ? (
                <>
                  {renderKeyLabel(keyLabel)}
                  <span className="text-muted-foreground">: </span>
                </>
              ) : null}
              {renderPrimitiveValue(node)}
              {trailingComma}
            </div>
          </div>
        );
      }

      const entries = Array.isArray(node)
        ? node.map((entry, index) => [index, entry] as const)
        : isJsonObject(node)
          ? Object.entries(node)
          : [];
      const opener = Array.isArray(node) ? "[" : "{";
      const closer = Array.isArray(node) ? "]" : "}";

      if (!isExpanded) {
        return (
          <button
            key={pathId}
            type="button"
            className="flex w-full items-start gap-2 px-3 py-0.5 text-left font-mono text-xs leading-6 transition-colors hover:bg-background/45"
            style={indentStyle}
            onClick={() => togglePath(pathId)}
            aria-expanded={false}
          >
            <ChevronRight className="mt-[5px] h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 break-all">
              {keyLabel !== undefined ? (
                <>
                  {renderKeyLabel(keyLabel)}
                  <span className="text-muted-foreground">: </span>
                </>
              ) : null}
              <span className="text-muted-foreground">{formatCollapsedSummary(node)}</span>
              {trailingComma}
            </div>
          </button>
        );
      }

      return (
        <div key={pathId || "root"}>
          {!isRoot ? (
            <button
              type="button"
              className="flex w-full items-start gap-2 px-3 py-0.5 text-left font-mono text-xs leading-6 transition-colors hover:bg-background/45"
              style={indentStyle}
              onClick={() => togglePath(pathId)}
              aria-expanded
            >
              <ChevronDown className="mt-[5px] h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 break-all">
                {renderKeyLabel(keyLabel as JsonPathSegment)}
                <span className="text-muted-foreground">: {opener}</span>
              </div>
            </button>
          ) : (
            <div
              className="px-3 py-0.5 font-mono text-xs leading-6 text-muted-foreground"
              style={indentStyle}
            >
              {opener}
            </div>
          )}

          {entries.map(([childKey, childValue], index) =>
            renderNode(childValue, [...path, childKey], depth + 1, index === entries.length - 1, childKey),
          )}

          <div
            className="flex items-start gap-2 px-3 py-0.5 font-mono text-xs leading-6"
            style={indentStyle}
          >
            {!isRoot ? <span className="h-3.5 w-3.5 shrink-0" /> : null}
            <div className="min-w-0 break-all text-muted-foreground">
              {closer}
              {trailingComma}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        aria-label={ariaLabel}
        className={cn(
          "overflow-auto bg-background/10 py-2 text-foreground",
          className,
        )}
      >
        {renderNode(value, [], 0, true)}
      </div>
    );
  },
);
