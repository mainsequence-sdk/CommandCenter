import { useEffect, useMemo, useState } from "react";

import { ArrowUpRight, ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AppComponentRequestTestSection, type AppComponentRequestTestState } from "@/widgets/core/app-component/AppComponentRequestTestSection";
import { AppComponentResponseNotification } from "@/widgets/core/app-component/AppComponentResponseNotification";
import { AppComponentSchemaDiscoverySection } from "@/widgets/core/app-component/AppComponentSchemaDiscoverySection";
import { AppComponentServiceHeadersEditor } from "@/widgets/core/app-component/AppComponentServiceHeadersEditor";
import { submitAppComponentRequest } from "@/widgets/core/app-component/appComponentApi";
import {
  buildAppComponentRequest,
  listAppComponentRequestBodyContentTypes,
  normalizeAppComponentProps,
  resolveAppComponentInitialDraftValues,
  resolveAppComponentOperation,
  resolveAppComponentResponseNotification,
  type AppComponentWidgetProps,
} from "@/widgets/core/app-component/appComponentModel";
import { useAppComponentSchemaExplorer } from "@/widgets/core/app-component/useAppComponentSchemaExplorer";

import type { EntitySummaryHeader } from "../../../../common/api";

function linkClassName(disabled = false) {
  return cn(
    "inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border bg-card/75 px-3 text-xs font-medium text-foreground transition-colors",
    disabled ? "pointer-events-none opacity-50" : "hover:bg-muted/55",
  );
}

function resolveReleasePublicUrl(summary: EntitySummaryHeader) {
  const matchedField =
    summary.highlight_fields.find((field) => field.key === "public_url") ??
    summary.inline_fields.find((field) => field.key === "public_url");

  if (typeof matchedField?.href === "string" && matchedField.href.trim()) {
    return matchedField.href;
  }

  return typeof matchedField?.value === "string" ? matchedField.value : "";
}

function resolveReleaseSubdomain(summary: EntitySummaryHeader) {
  const matchedField =
    summary.highlight_fields.find((field) => field.key === "subdomain") ??
    summary.inline_fields.find((field) => field.key === "subdomain");

  if (typeof matchedField?.value === "string" && matchedField.value.trim()) {
    return matchedField.value.trim();
  }

  const publicUrl = resolveReleasePublicUrl(summary);

  if (!publicUrl) {
    return "";
  }

  try {
    const url = new URL(publicUrl);
    const [firstLabel] = url.hostname.split(".").filter(Boolean);
    return firstLabel?.trim() ?? "";
  } catch {
    return "";
  }
}

function buildInitialTesterProps(
  resourceReleaseId: number,
  apiBaseUrl: string,
  subdomain: string,
) {
  return normalizeAppComponentProps({
    apiTargetMode: "main-sequence-resource-release",
    mainSequenceResourceRelease: {
      releaseId: resourceReleaseId,
      label: releasePublicTitle(apiBaseUrl, subdomain, resourceReleaseId),
      releaseKind: "fastapi",
      publicUrl: apiBaseUrl || undefined,
      exchangeLaunchUrl: `/orm/api/pods/resource-release/${resourceReleaseId}/exchange-launch/`,
      subdomain: subdomain || undefined,
    },
    apiBaseUrl,
    method: undefined,
    path: undefined,
    requestBodyContentType: undefined,
    refreshOnDashboardRefresh: false,
    showHeader: true,
    showResponse: false,
    hideRequestButton: false,
  });
}

function releasePublicTitle(apiBaseUrl: string, subdomain: string, resourceReleaseId: number) {
  if (subdomain.trim()) {
    return subdomain.trim();
  }

  if (apiBaseUrl.trim()) {
    return apiBaseUrl.trim();
  }

  return `Release ${resourceReleaseId}`;
}

export function MainSequenceResourceReleaseApiTestTab({
  releaseSummary,
  resourceReleaseId,
}: {
  releaseSummary: EntitySummaryHeader;
  resourceReleaseId: number;
}) {
  const releasePublicUrl = useMemo(
    () => resolveReleasePublicUrl(releaseSummary),
    [releaseSummary],
  );
  const releaseSubdomain = useMemo(
    () => resolveReleaseSubdomain(releaseSummary),
    [releaseSummary],
  );
  const [searchValue, setSearchValue] = useState("");
  const [testerProps, setTesterProps] = useState<AppComponentWidgetProps>(() =>
    buildInitialTesterProps(resourceReleaseId, releasePublicUrl, releaseSubdomain),
  );
  const normalizedTesterProps = useMemo(
    () => normalizeAppComponentProps(testerProps),
    [testerProps],
  );
  const {
    discoveryConfigured,
    docsUrl,
    openApiUrl,
    openApiQuery,
    filteredOperations,
    resolvedOperation,
    operationResponseStatusByKey,
    responseModelStatus,
    responseModelPreview,
    responseUiDescriptor,
    contentTypes,
    generatedForm,
    mappedRequestForms,
  } = useAppComponentSchemaExplorer({
    enabled: true,
    normalizedProps: normalizedTesterProps,
    searchValue,
  });
  const mappedSubmissionForm = mappedRequestForms.submissionForm;
  const initialDraftValues = useMemo(
    () =>
      resolveAppComponentInitialDraftValues(
        mappedSubmissionForm,
        {},
        resolvedOperation?.record.key,
        {
          prefillValues: mappedRequestForms.prefillValues,
        },
      ),
    [mappedRequestForms.prefillValues, mappedSubmissionForm, resolvedOperation?.record.key],
  );
  const initialDraftValuesKey = useMemo(
    () => JSON.stringify(initialDraftValues),
    [initialDraftValues],
  );
  const [testDraftValues, setTestDraftValues] =
    useState<Record<string, string>>(initialDraftValues);
  const [testState, setTestState] = useState<AppComponentRequestTestState>({
    status: "idle",
  });
  const responsePreview = useMemo(() => {
    if (
      typeof testState.lastResponseStatus !== "number" ||
      testState.lastResponseStatus < 200 ||
      testState.lastResponseStatus >= 300
    ) {
      return undefined;
    }

    const notification = resolveAppComponentResponseNotification(
      testState.lastResponseBody,
      responseUiDescriptor,
    );

    return notification
      ? <AppComponentResponseNotification notification={notification} />
      : undefined;
  }, [responseUiDescriptor, testState.lastResponseBody, testState.lastResponseStatus]);

  useEffect(() => {
    setTesterProps(
      buildInitialTesterProps(resourceReleaseId, releasePublicUrl, releaseSubdomain),
    );
    setSearchValue("");
    setTestState({
      status: "idle",
    });
  }, [releasePublicUrl, releaseSubdomain, resourceReleaseId]);

  useEffect(() => {
    setTestDraftValues(initialDraftValues);
    setTestState({
      status: "idle",
    });
  }, [initialDraftValuesKey]);

  async function handleTestSubmit() {
    setTestState((current) => ({
      ...current,
      status: "submitting",
      error: undefined,
    }));

    const buildResult = buildAppComponentRequest(
      normalizedTesterProps,
      mappedSubmissionForm,
      testDraftValues,
    );

    if (!buildResult.request) {
      setTestState((current) => ({
        ...current,
        status: "error",
        error: buildResult.errors.join(" "),
      }));
      return;
    }

    try {
      const response = await submitAppComponentRequest({
        transportProps: normalizedTesterProps,
        method: buildResult.request.method,
        url: buildResult.request.url,
        headers: buildResult.request.headers,
        body: buildResult.request.body,
        cache: {
          enabled: false,
        },
      });

      setTestState({
        status: response.ok ? "success" : "error",
        lastExecutedAtMs: Date.now(),
        lastRequestUrl: response.url,
        lastResponseStatus: response.status,
        lastResponseBody: response.body,
        error:
          response.ok
            ? undefined
            : typeof response.body === "string"
              ? response.body
              : `Request failed with ${response.status}.`,
      });
    } catch (error) {
      setTestState({
        status: "error",
        lastExecutedAtMs: Date.now(),
        lastRequestUrl: buildResult.request.url,
        error:
          error instanceof Error
            ? error.message
            : "The browser could not reach the configured API.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">Test API</div>
        <p className="text-sm text-muted-foreground">
          This is the AppComponent request console reused outside the widget canvas. Pick an
          operation, fill the generated request inputs, and inspect the response plus raw payload
          for this FastAPI release.
        </p>
      </div>

      <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-topbar-foreground">API Target</div>
          <p className="text-sm text-muted-foreground">
            This tester is locked to the selected Main Sequence FastAPI resource release. It uses
            the release exchange-launch endpoint to fetch a short-lived RPC token, then calls the
            public FastAPI with that launch token plus <code>X-FastAPI-ID</code>.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">OpenAPI or service URL</span>
            <Input
              value={normalizedTesterProps.apiBaseUrl ?? ""}
              placeholder="https://api.example.com/service/openapi.json"
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              This mirrors the release public URL when one is exposed. Runtime schema discovery and
              requests use the exchange-launch RPC target instead of the generic AppComponent URL
              transport.
            </p>
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">Transport</span>
            <div className="rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-3 text-sm text-success">
              Release exchange-launch token
            </div>
          </div>
        </div>

        <AppComponentServiceHeadersEditor
          headers={normalizedTesterProps.serviceHeaders}
          onChange={(serviceHeaders) => {
            setTesterProps((current) => ({
              ...current,
              serviceHeaders,
            }));
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <a href={docsUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!docsUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            Swagger UI
          </a>
          <a href={openApiUrl ?? "#"} target="_blank" rel="noreferrer" className={linkClassName(!openApiUrl)}>
            <ArrowUpRight className="h-3.5 w-3.5" />
            OpenAPI JSON
          </a>
          <span className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-6px)] border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            Requests use a temporary Main Sequence launch token
          </span>
        </div>

        {!releasePublicUrl ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            This release summary does not expose a public URL. The tester can still resolve the
            FastAPI through exchange-launch, but the external docs links stay unavailable until the
            backend provides a public URL.
          </div>
        ) : null}
      </section>

      <AppComponentSchemaDiscoverySection
        contentTypes={contentTypes}
        discoveryConfigured={discoveryConfigured}
        editable
        filteredOperations={filteredOperations}
        generatedForm={generatedForm}
        onRequestBodyContentTypeChange={(contentType) => {
          setTesterProps((current) => ({
            ...current,
            requestBodyContentType: contentType,
          }));
        }}
        onSearchValueChange={setSearchValue}
        onSelectOperation={(operation) => {
          if (!openApiQuery.data) {
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

          setTesterProps((current) => ({
            ...current,
            method: operation.method,
            path: operation.path,
            requestBodyContentType:
              nextContentTypes.includes("application/json")
                ? "application/json"
                : nextContentTypes[0] ?? undefined,
          }));
        }}
        openApiDocument={openApiQuery.data}
        openApiError={openApiQuery.error}
        openApiLoading={openApiQuery.isLoading}
        operationResponseStatusByKey={operationResponseStatusByKey}
        resolvedOperation={resolvedOperation}
        responseModelPreview={responseModelPreview}
        responseModelStatus={responseModelStatus}
        searchValue={searchValue}
        selectedMethod={normalizedTesterProps.method}
        selectedPath={normalizedTesterProps.path}
      />

      {resolvedOperation ? (
        <AppComponentRequestTestSection
          description="Developer-focused request runner for the selected release endpoint. It still keeps the raw payload visible for transport debugging, but now also shows any response notification preview advertised by the API."
          disabled={testState.status === "submitting"}
          effectiveDraftValues={testDraftValues}
          form={mappedSubmissionForm}
          onSubmit={handleTestSubmit}
          onValueChange={(fieldKey, nextValue) => {
            setTestDraftValues((current) => ({
              ...current,
              [fieldKey]: nextValue,
            }));
          }}
          onValuePatch={(patch) => {
            setTestDraftValues((current) => ({
              ...current,
              ...patch,
            }));
          }}
          requestProps={normalizedTesterProps}
          responsePreview={responsePreview}
          showPublishedOutputs={false}
          state={testState}
          submitDisabled={testState.status === "submitting"}
          submitLabel="Send request"
        />
      ) : null}
    </div>
  );
}
