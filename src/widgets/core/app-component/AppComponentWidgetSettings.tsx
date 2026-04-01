import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { buildAppComponentOpenApiQueryKey, fetchAppComponentOpenApiDocument } from "./appComponentApi";
import {
  buildAppComponentDocsUrl,
  buildAppComponentGeneratedForm,
  buildAppComponentOpenApiUrl,
  formatAppComponentFieldLocation,
  formatAppComponentMethodLabel,
  listAppComponentOperations,
  listAppComponentRequestBodyContentTypes,
  normalizeAppComponentProps,
  normalizeAppComponentRuntimeState,
  resolveAppComponentOperation,
  tryResolveAppComponentBaseUrl,
  type AppComponentWidgetProps,
} from "./appComponentModel";

function linkClassName(disabled = false) {
  return cn(
    "inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border bg-card/75 px-3 text-xs font-medium text-foreground transition-colors",
    disabled ? "pointer-events-none opacity-50" : "hover:bg-muted/55",
  );
}

export function AppComponentWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
}: WidgetSettingsComponentProps<AppComponentWidgetProps>) {
  const normalizedProps = useMemo(() => normalizeAppComponentProps(draftProps), [draftProps]);
  const resolvedBaseUrl = useMemo(
    () => tryResolveAppComponentBaseUrl(normalizedProps.apiBaseUrl),
    [normalizedProps.apiBaseUrl],
  );
  const docsUrl = useMemo(
    () => buildAppComponentDocsUrl(normalizedProps.apiBaseUrl),
    [normalizedProps.apiBaseUrl],
  );
  const openApiUrl = useMemo(
    () => buildAppComponentOpenApiUrl(normalizedProps.apiBaseUrl),
    [normalizedProps.apiBaseUrl],
  );
  const [searchValue, setSearchValue] = useState("");
  const openApiQuery = useQuery({
    queryKey: buildAppComponentOpenApiQueryKey(
      resolvedBaseUrl,
      normalizedProps.authMode ?? "session-jwt",
    ),
    queryFn: () =>
      fetchAppComponentOpenApiDocument({
        baseUrl: resolvedBaseUrl ?? "",
        authMode: normalizedProps.authMode,
      }),
    enabled: resolvedBaseUrl !== null,
    staleTime: 300_000,
  });
  const operations = useMemo(
    () => (openApiQuery.data ? listAppComponentOperations(openApiQuery.data) : []),
    [openApiQuery.data],
  );
  const filteredOperations = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return operations;
    }

    return operations.filter((operation) =>
      [operation.method, operation.path, operation.summary, operation.description, operation.operationId, operation.tags.join(" ")]
        .filter((entry): entry is string => Boolean(entry))
        .some((entry) => entry.toLowerCase().includes(normalizedSearch)),
    );
  }, [operations, searchValue]);
  const resolvedOperation = useMemo(
    () =>
      openApiQuery.data
        ? resolveAppComponentOperation(
            openApiQuery.data,
            normalizedProps.method,
            normalizedProps.path,
          )
        : null,
    [normalizedProps.method, normalizedProps.path, openApiQuery.data],
  );
  const contentTypes = useMemo(
    () =>
      openApiQuery.data
        ? listAppComponentRequestBodyContentTypes(openApiQuery.data, resolvedOperation)
        : [],
    [openApiQuery.data, resolvedOperation],
  );
  const generatedForm = useMemo(
    () =>
      openApiQuery.data
        ? buildAppComponentGeneratedForm(
            openApiQuery.data,
            resolvedOperation,
            normalizedProps.requestBodyContentType,
          )
        : null,
    [normalizedProps.requestBodyContentType, openApiQuery.data, resolvedOperation],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">OpenAPI</Badge>
        <Badge variant="neutral">Core widget</Badge>
        <Badge variant="neutral">JWT by default</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Explore a target API from <code>/openapi.json</code>, bind this widget to one route, and
        render the request form directly inside the workspace.
      </div>

      <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-topbar-foreground">API Target</div>
          <p className="text-sm text-muted-foreground">
            The widget assumes the target service exposes <code>/docs</code> and{" "}
            <code>/openapi.json</code> at the same root.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">API base URL</span>
            <Input
              value={normalizedProps.apiBaseUrl ?? ""}
              readOnly={!editable}
              placeholder={resolvedBaseUrl ?? "https://api.example.com"}
              onChange={(event) => {
                onDraftPropsChange({
                  ...draftProps,
                  apiBaseUrl: event.target.value,
                });
              }}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">Auth mode</span>
            <Select
              value={normalizedProps.authMode ?? "session-jwt"}
              disabled={!editable}
              onChange={(event) => {
                onDraftPropsChange({
                  ...draftProps,
                  authMode: event.target.value as AppComponentWidgetProps["authMode"],
                });
              }}
            >
              <option value="session-jwt">Session JWT</option>
              <option value="none">No auth</option>
            </Select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a href={docsUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!docsUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            Swagger UI
          </a>
          <a href={openApiUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!openApiUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            OpenAPI JSON
          </a>
          {normalizedProps.authMode !== "none" ? (
            <span className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Requests attach the current session JWT
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-topbar-foreground">Schema Discovery</div>
            <p className="text-sm text-muted-foreground">
              Load the OpenAPI document and choose one operation for this widget instance.
            </p>
          </div>

          {openApiQuery.isLoading ? (
            <div className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading schema
            </div>
          ) : openApiQuery.data ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-3 py-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">
                {openApiQuery.data.info?.title ?? "OpenAPI schema"}
              </div>
              <div>
                {openApiQuery.data.info?.version ?? "Unknown version"} · {operations.length} routes
              </div>
            </div>
          ) : null}
        </div>

        {!resolvedBaseUrl ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
            Enter a valid API base URL to load the OpenAPI schema.
          </div>
        ) : openApiQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
            {openApiQuery.error instanceof Error
              ? openApiQuery.error.message
              : "Unable to load the target OpenAPI document."}
          </div>
        ) : openApiQuery.data ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
            <div className="space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  placeholder="Search method, path, tag, or summary"
                  className="pl-9"
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                  }}
                />
              </label>

              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {filteredOperations.map((operation) => {
                  const selected =
                    operation.method === normalizedProps.method &&
                    operation.path === normalizedProps.path;

                  return (
                    <button
                      key={operation.key}
                      type="button"
                      className={cn(
                        "w-full rounded-[calc(var(--radius)-6px)] border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/70 bg-background/18 hover:bg-muted/35",
                      )}
                      onClick={() => {
                        if (!editable) {
                          return;
                        }

                        const nextResolvedOperation = resolveAppComponentOperation(
                          openApiQuery.data,
                          operation.method,
                          operation.path,
                        );
                        const nextContentTypes = listAppComponentRequestBodyContentTypes(
                          openApiQuery.data,
                          nextResolvedOperation,
                        );

                        onDraftPropsChange({
                          ...draftProps,
                          method: operation.method,
                          path: operation.path,
                          requestBodyContentType:
                            nextContentTypes.includes("application/json")
                              ? "application/json"
                              : nextContentTypes[0] ?? undefined,
                        });
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={selected ? "primary" : "neutral"}>
                          {formatAppComponentMethodLabel(operation.method)}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {operation.path}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {operation.summary}
                      </div>
                      {operation.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {operation.tags.map((tag) => (
                            <Badge key={tag} variant="neutral" className="py-0.5">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                })}

                {filteredOperations.length === 0 ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/18 px-4 py-5 text-sm text-muted-foreground">
                    No operations matched the current search.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 p-4">
              {resolvedOperation ? (
                <>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">
                        {formatAppComponentMethodLabel(resolvedOperation.record.method)}
                      </Badge>
                      <Badge variant="neutral">{resolvedOperation.record.path}</Badge>
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {resolvedOperation.record.summary}
                    </div>
                    {resolvedOperation.record.description ? (
                      <p className="text-sm text-muted-foreground">
                        {resolvedOperation.record.description}
                      </p>
                    ) : null}
                  </div>

                  {contentTypes.length > 1 ? (
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-topbar-foreground">
                        Request body content type
                      </span>
                      <Select
                        value={
                          normalizedProps.requestBodyContentType ??
                          contentTypes[0] ??
                          ""
                        }
                        disabled={!editable}
                        onChange={(event) => {
                          onDraftPropsChange({
                            ...draftProps,
                            requestBodyContentType: event.target.value || undefined,
                          });
                        }}
                      >
                        {contentTypes.map((contentType) => (
                          <option key={contentType} value={contentType}>
                            {contentType}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Parameters
                      </div>
                      <div className="mt-2 space-y-2">
                        {generatedForm?.parameterFields.length ? (
                          generatedForm.parameterFields.map((field) => (
                            <div key={field.key} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{field.label}</span>{" "}
                              · {formatAppComponentFieldLocation(field.location)}
                              {field.required ? " · required" : ""}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            No explicit parameters.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Request body
                      </div>
                      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                        <div>
                          Mode:{" "}
                          <span className="font-medium text-foreground">
                            {generatedForm?.bodyMode ?? "none"}
                          </span>
                        </div>
                        <div>
                          Content type:{" "}
                          <span className="font-medium text-foreground">
                            {generatedForm?.bodyContentType ?? "none"}
                          </span>
                        </div>
                        {generatedForm?.unsupportedReason ? (
                          <div>{generatedForm.unsupportedReason}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[calc(var(--radius)-7px)] border border-dashed border-border/70 bg-background/22 px-4 py-5 text-sm text-muted-foreground">
                  Select an operation on the left to bind this widget instance to one route.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
