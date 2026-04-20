import { Search, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  formatAppComponentFieldLocation,
  formatAppComponentMethodLabel,
  listAppComponentRenderableParameterFields,
  resolveAppComponentResponseModelPreview,
  resolveAppComponentResponseModelStatus,
  type AppComponentGeneratedForm,
  type AppComponentOperationRecord,
  type OpenApiDocument,
  type ResolvedAppComponentOperation,
} from "./appComponentModel";
import { AppComponentOpenApiDiscoveryError } from "./appComponentApi";

function formatAuthModeTag(authMode: AppComponentOpenApiDiscoveryError["authMode"]) {
  if (authMode === "none") {
    return "No automatic auth";
  }

  return "session-jwt";
}

function formatAuthorizationSource(
  source: AppComponentOpenApiDiscoveryError["authHeaderSource"],
) {
  switch (source) {
    case "configured-header":
      return "Authorization set in service headers";
    case "session-jwt":
      return "Session JWT attached";
    default:
      return "No Authorization header";
  }
}

function formatBoolean(value: boolean | undefined) {
  return value ? "yes" : "no";
}

function buildResponseModelWarningMessage(
  responseModelStatus: {
    declaredResponseCodes: string[];
    missingResponseCodes: string[];
    modeledResponseCodes: string[];
    optionalMissingResponseCodes: string[];
  },
) {
  const {
    declaredResponseCodes,
    missingResponseCodes,
    modeledResponseCodes,
    optionalMissingResponseCodes,
  } = responseModelStatus;
  const allMissingResponseCodes = [...missingResponseCodes, ...optionalMissingResponseCodes];

  if (declaredResponseCodes.length === 0) {
    return "Incorrect endpoint: the operation does not declare any OpenAPI responses.";
  }

  if (modeledResponseCodes.length === 0) {
    return `Incorrect endpoint: none of the declared responses include a response model. Missing schema for ${allMissingResponseCodes.join(", ")}.`;
  }

  return `Incorrect endpoint: every required response should include a response model. Missing schema for ${missingResponseCodes.join(", ")}.`;
}

export interface AppComponentSchemaDiscoverySectionProps {
  contentTypes: string[];
  discoveryConfigured: boolean;
  editable: boolean;
  filteredOperations: AppComponentOperationRecord[];
  generatedForm: AppComponentGeneratedForm | null;
  onRequestBodyContentTypeChange: (contentType: string | undefined) => void;
  onSearchValueChange: (value: string) => void;
  onSelectOperation: (operation: AppComponentOperationRecord) => void;
  openApiDocument?: OpenApiDocument;
  openApiError?: unknown;
  openApiLoading: boolean;
  operationResponseStatusByKey: Map<
    string,
    NonNullable<ReturnType<typeof resolveAppComponentResponseModelStatus>>
  >;
  resolvedOperation: ResolvedAppComponentOperation | null;
  responseModelPreview: ReturnType<typeof resolveAppComponentResponseModelPreview>;
  responseModelStatus: ReturnType<typeof resolveAppComponentResponseModelStatus>;
  searchValue: string;
  selectedMethod?: string;
  selectedPath?: string;
}

export function AppComponentSchemaDiscoverySection({
  contentTypes,
  discoveryConfigured,
  editable,
  filteredOperations,
  generatedForm,
  onRequestBodyContentTypeChange,
  onSearchValueChange,
  onSelectOperation,
  openApiDocument,
  openApiError,
  openApiLoading,
  operationResponseStatusByKey,
  resolvedOperation,
  responseModelPreview,
  responseModelStatus,
  searchValue,
  selectedMethod,
  selectedPath,
}: AppComponentSchemaDiscoverySectionProps) {
  const openApiDiscoveryError =
    openApiError instanceof AppComponentOpenApiDiscoveryError ? openApiError : null;

  return (
    <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-medium text-topbar-foreground">Schema Discovery</div>
          <p className="text-sm text-muted-foreground">
            Load the OpenAPI document and choose one operation for this request session.
          </p>
        </div>

        {openApiLoading ? (
          <div className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-3 py-2 text-xs text-muted-foreground">
            Loading schema
          </div>
        ) : openApiDocument ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/28 px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              {openApiDocument.info?.title ?? "OpenAPI schema"}
            </div>
            <div>
              {openApiDocument.info?.version ?? "Unknown version"} · {filteredOperations.length} routes
            </div>
          </div>
        ) : null}
      </div>

      {!discoveryConfigured ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
          Enter a valid OpenAPI URL, Swagger docs URL, or service root, or select a Main Sequence resource release to load the schema.
        </div>
      ) : openApiError ? (
        <div className="space-y-3 rounded-[calc(var(--radius)-6px)] border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
          <div>
            {openApiError instanceof Error
              ? openApiError.message
              : "Unable to load the target OpenAPI document."}
          </div>
          {openApiDiscoveryError?.requestTransport || openApiDiscoveryError?.authMode ? (
            <div className="space-y-1 rounded-[calc(var(--radius)-8px)] border border-danger/30 bg-black/20 p-3 text-xs text-danger/95">
              <div className="font-semibold uppercase tracking-[0.14em]">Request auth context</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span>Auth mode: {formatAuthModeTag(openApiDiscoveryError.authMode)}</span>
                <span>Transport: {openApiDiscoveryError.requestTransport ?? "unknown"}</span>
                <span>
                  Session JWT present:
                  {formatBoolean(openApiDiscoveryError.authTokenPresent)}
                </span>
                <span>
                  Authorization configured:{" "}
                  {formatBoolean(openApiDiscoveryError.authorizationHeaderConfigured)}
                </span>
                <span>
                  Authorization source: {formatAuthorizationSource(openApiDiscoveryError.authHeaderSource)}
                </span>
                <span>
                  Authorization attached:
                  {formatBoolean(openApiDiscoveryError.authHeaderAttached)}
                </span>
              </div>
            </div>
          ) : null}
          {openApiDiscoveryError?.responseSample ? (
            <div className="space-y-2 rounded-[calc(var(--radius)-8px)] border border-danger/30 bg-black/20 p-3 text-danger/95">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                <span>Response sample</span>
                {openApiDiscoveryError.responseStatus ? (
                  <span className="text-danger/80">
                    Status {openApiDiscoveryError.responseStatus}
                  </span>
                ) : null}
                {openApiDiscoveryError.responseContentType ? (
                  <span className="text-danger/80">
                    {openApiDiscoveryError.responseContentType}
                  </span>
                ) : null}
              </div>
              <pre className="max-h-64 overflow-auto rounded-[calc(var(--radius)-10px)] border border-danger/25 bg-black/25 p-3 text-xs leading-5 whitespace-pre-wrap break-words text-danger/95">
                {openApiDiscoveryError.responseSample}
              </pre>
            </div>
          ) : null}
        </div>
      ) : openApiDocument ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
            <div className="space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  placeholder="Search method, path, tag, or summary"
                  className="pl-9"
                  onChange={(event) => {
                    onSearchValueChange(event.target.value);
                  }}
                />
              </label>

              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {filteredOperations.map((operation) => {
                  const selected =
                    operation.method === selectedMethod && operation.path === selectedPath;
                  const operationStatus = operationResponseStatusByKey.get(operation.key);

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

                        onSelectOperation(operation);
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={selected ? "primary" : "neutral"}>
                          {formatAppComponentMethodLabel(operation.method)}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {operation.path}
                        </span>
                        {operationStatus && !operationStatus.isValidEndpoint ? (
                          <Badge variant="danger" className="py-0.5">
                            Incorrect
                          </Badge>
                        ) : null}
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
                      {responseModelStatus ? (
                        <Badge
                          variant={responseModelStatus.isValidEndpoint ? "success" : "danger"}
                        >
                          {responseModelStatus.isValidEndpoint
                            ? "Response model"
                            : "Incorrect endpoint"}
                        </Badge>
                      ) : null}
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

                  {responseModelStatus && !responseModelStatus.isValidEndpoint ? (
                    <div className="rounded-[calc(var(--radius)-7px)] border border-danger/35 bg-danger/10 px-3 py-3 text-sm text-danger">
                      <div className="flex items-start gap-2">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="space-y-1">
                          <div>{buildResponseModelWarningMessage(responseModelStatus)}</div>
                          {responseModelStatus.modeledResponseCodes.length > 0 ? (
                            <div className="text-xs text-danger/90">
                              Modeled responses: {responseModelStatus.modeledResponseCodes.join(", ")}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/30 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Response model
                    </div>
                    <div className="mt-2 space-y-3">
                      {responseModelPreview.length > 0 ? (
                        responseModelPreview.map((entry) => (
                          <div
                            key={entry.key}
                            className={cn(
                              "rounded-[calc(var(--radius)-8px)] border px-3 py-3",
                              entry.hasSchema
                                ? "border-border/60 bg-background/45"
                                : "border-danger/30 bg-danger/6",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={entry.hasSchema ? "success" : "danger"}>
                                {entry.statusCode}
                              </Badge>
                              <Badge variant="neutral">
                                {entry.contentType ?? "no content"}
                              </Badge>
                              {entry.schemaTypeLabel ? (
                                <span className="text-xs font-medium text-foreground">
                                  {entry.schemaTypeLabel}
                                </span>
                              ) : null}
                            </div>
                            {entry.description ? (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {entry.description}
                              </div>
                            ) : null}
                            {entry.hasSchema ? (
                              entry.fields.length > 0 ? (
                                <div className="mt-2 space-y-1.5">
                                  {entry.fields.map((field) => (
                                    <div
                                      key={`${entry.key}:${field.path}`}
                                      className="text-xs text-muted-foreground"
                                    >
                                      <span className="font-mono text-foreground">
                                        {field.path}
                                      </span>{" "}
                                      · {field.typeLabel}
                                      {field.required ? " · required" : ""}
                                      {field.description ? ` · ${field.description}` : ""}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Schema is declared, but no explicit fields were expanded.
                                </div>
                              )
                            ) : (
                              <div className="mt-2 text-xs text-danger">
                                No response schema declared for this response.
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          No responses declared.
                        </div>
                      )}
                    </div>
                  </div>

                  {contentTypes.length > 1 ? (
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-topbar-foreground">
                        Request body content type
                      </span>
                      <Select
                        value={
                          generatedForm?.bodyContentType ??
                          contentTypes[0] ??
                          ""
                        }
                        disabled={!editable}
                        onChange={(event) => {
                          onRequestBodyContentTypeChange(event.target.value || undefined);
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
                        {listAppComponentRenderableParameterFields(generatedForm).length ? (
                          listAppComponentRenderableParameterFields(generatedForm).map((field) => (
                            <div key={field.key} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{field.label}</span>{" "}
                              · {formatAppComponentFieldLocation(field.location)}
                              {field.required ? " · required" : ""}
                              {field.uiEnhancement?.widget === "select2" &&
                              field.uiEnhancement.role === "async-select-search"
                                ? " · select2 async search"
                                : ""}
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
                  Select an operation on the left to bind this request session to one route.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
