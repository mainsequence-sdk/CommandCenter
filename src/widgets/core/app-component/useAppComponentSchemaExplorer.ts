import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import {
  APP_COMPONENT_OPENAPI_CACHE_TTL_MS,
  buildAppComponentOpenApiQueryKey,
  fetchAppComponentOpenApiDocument,
} from "./appComponentApi";
import {
  buildAppComponentBindingSpec,
  buildAppComponentDocsUrl,
  buildAppComponentGeneratedForm,
  buildAppComponentOpenApiUrl,
  hasAppComponentDiscoveryTarget,
  listAppComponentOperations,
  listAppComponentRequestBodyContentTypes,
  normalizeAppComponentBindingSpec,
  reconcileAppComponentRequestInputMap,
  resolveAppComponentDisplayBaseUrl,
  resolveAppComponentMappedRequestForms,
  resolveAppComponentOperation,
  resolveAppComponentResponseModelPreview,
  resolveAppComponentResponseModelStatus,
  tryResolveAppComponentBaseUrl,
  type AppComponentWidgetProps,
} from "./appComponentModel";

export function useAppComponentSchemaExplorer({
  enabled = true,
  normalizedProps,
  searchValue,
}: {
  enabled?: boolean;
  normalizedProps: AppComponentWidgetProps;
  searchValue: string;
}) {
  const discoveryBaseUrl = useMemo(
    () => resolveAppComponentDisplayBaseUrl(normalizedProps),
    [normalizedProps],
  );
  const resolvedBaseUrl = useMemo(
    () => tryResolveAppComponentBaseUrl(discoveryBaseUrl),
    [discoveryBaseUrl],
  );
  const discoveryConfigured = useMemo(
    () => hasAppComponentDiscoveryTarget(normalizedProps),
    [normalizedProps],
  );
  const docsUrl = useMemo(
    () => buildAppComponentDocsUrl(discoveryBaseUrl),
    [discoveryBaseUrl],
  );
  const openApiUrl = useMemo(
    () => buildAppComponentOpenApiUrl(discoveryBaseUrl),
    [discoveryBaseUrl],
  );
  const openApiQuery = useQuery({
    queryKey: buildAppComponentOpenApiQueryKey(normalizedProps),
    queryFn: () =>
      fetchAppComponentOpenApiDocument({
        props: normalizedProps,
      }),
    enabled: enabled && discoveryConfigured,
    staleTime: APP_COMPONENT_OPENAPI_CACHE_TTL_MS,
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
      [
        operation.method,
        operation.path,
        operation.summary,
        operation.description,
        operation.operationId,
        operation.tags.join(" "),
      ]
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
  const operationResponseStatusByKey = useMemo(() => {
    const next = new Map<
      string,
      NonNullable<ReturnType<typeof resolveAppComponentResponseModelStatus>>
    >();

    if (!openApiQuery.data) {
      return next;
    }

    for (const operation of operations) {
      const status = resolveAppComponentResponseModelStatus(
        openApiQuery.data,
        resolveAppComponentOperation(openApiQuery.data, operation.method, operation.path),
      );

      if (status) {
        next.set(operation.key, status);
      }
    }

    return next;
  }, [openApiQuery.data, operations]);
  const responseModelStatus = useMemo(
    () =>
      openApiQuery.data
        ? resolveAppComponentResponseModelStatus(openApiQuery.data, resolvedOperation)
        : null,
    [openApiQuery.data, resolvedOperation],
  );
  const responseModelPreview = useMemo(
    () =>
      openApiQuery.data
        ? resolveAppComponentResponseModelPreview(openApiQuery.data, resolvedOperation)
        : [],
    [openApiQuery.data, resolvedOperation],
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
  const mappedRequestForms = useMemo(
    () => resolveAppComponentMappedRequestForms(generatedForm, normalizedProps),
    [generatedForm, normalizedProps],
  );
  const resolvedBindingSpec = useMemo(
    () =>
      openApiQuery.data
        ? buildAppComponentBindingSpec(openApiQuery.data, resolvedOperation, generatedForm)
        : undefined,
    [generatedForm, openApiQuery.data, resolvedOperation],
  );
  const normalizedResolvedBindingSpec = useMemo(
    () => normalizeAppComponentBindingSpec(resolvedBindingSpec),
    [resolvedBindingSpec],
  );
  const reconciledRequestInputMap = useMemo(
    () =>
      reconcileAppComponentRequestInputMap(
        normalizedProps.requestInputMap,
        generatedForm,
        resolvedOperation?.record.key,
      ),
    [generatedForm, normalizedProps.requestInputMap, resolvedOperation?.record.key],
  );

  return {
    resolvedBaseUrl,
    discoveryConfigured,
    docsUrl,
    openApiUrl,
    openApiQuery,
    operations,
    filteredOperations,
    resolvedOperation,
    operationResponseStatusByKey,
    responseModelStatus,
    responseModelPreview,
    contentTypes,
    generatedForm,
    mappedRequestForms,
    resolvedBindingSpec,
    normalizedResolvedBindingSpec,
    reconciledRequestInputMap,
  };
}
