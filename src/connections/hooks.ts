import { useEffect } from "react";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
  fetchConnectionInstances,
  fetchConnectionResource,
  fetchConnectionTypes,
  openConnectionStream,
  queryConnection,
} from "@/connections/api";
import type {
  ConnectionInstance,
  ConnectionQueryRequest,
  ConnectionQueryResponse,
  ConnectionResourceRequest,
  ConnectionStreamRequest,
  AnyConnectionTypeDefinition,
} from "@/connections/types";

export function useConnectionTypes(
  options?: Omit<
    UseQueryOptions<AnyConnectionTypeDefinition[]>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["connections", "types"],
    queryFn: fetchConnectionTypes,
    staleTime: 300_000,
    ...options,
  });
}

export function useConnectionInstances(
  options?: Omit<
    UseQueryOptions<ConnectionInstance[]>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["connections", "instances"],
    queryFn: fetchConnectionInstances,
    staleTime: 120_000,
    ...options,
  });
}

export function useConnectionQuery<
  TQuery = Record<string, unknown>,
  TResponse = ConnectionQueryResponse,
>(
  request: ConnectionQueryRequest<TQuery> | null | undefined,
  options?: Omit<UseQueryOptions<TResponse>, "queryKey" | "queryFn" | "enabled"> & {
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: ["connections", "query", request],
    queryFn: () => queryConnection<TQuery, TResponse>(request!),
    enabled: Boolean(request?.connectionId) && (options?.enabled ?? true),
    ...options,
  });
}

export function useConnectionResource<TResponse = unknown>(
  request: ConnectionResourceRequest | null | undefined,
  options?: Omit<UseQueryOptions<TResponse>, "queryKey" | "queryFn" | "enabled"> & {
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: ["connections", "resource", request],
    queryFn: () => fetchConnectionResource<TResponse>(request!),
    enabled: Boolean(request?.connectionId && request.resource) && (options?.enabled ?? true),
    ...options,
  });
}

export function useConnectionStream(
  request: ConnectionStreamRequest | null | undefined,
  options: {
    enabled?: boolean;
    onMessage: (message: MessageEvent) => void;
    onError?: (event: Event) => void;
  },
) {
  const stableParams = JSON.stringify(request?.params ?? {});

  useEffect(() => {
    if (!request?.connectionId || !request.channel || options.enabled === false) {
      return undefined;
    }

    const stream = openConnectionStream(request);
    stream.onmessage = options.onMessage;
    stream.onerror = options.onError ?? null;

    return () => {
      stream.close();
    };
  }, [
    options,
    request?.channel,
    request?.connectionId,
    stableParams,
  ]);
}
