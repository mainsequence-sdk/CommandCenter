import { useEffect, useRef } from "react";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
  createAuthenticatedConnectionQueryWebSocketSubscription,
  fetchConnectionInstances,
  fetchConnectionResource,
  fetchConnectionTypes,
  openConnectionStream,
  queryConnection,
} from "@/connections/api";
import type {
  ConnectionQueryWebSocketAuthenticationOptions,
  ConnectionQueryWebSocketHandlers,
} from "@/connections/api";
import type {
  ConnectionInstance,
  ConnectionQueryRequest,
  ConnectionQueryResponse,
  ConnectionResourceRequest,
  ConnectionStreamQueryRequest,
  ConnectionStreamServerMessage,
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

export function useConnectionQueryWebSocket<TQuery = Record<string, unknown>>(
  request: ConnectionStreamQueryRequest<TQuery> | null | undefined,
  options: ConnectionQueryWebSocketAuthenticationOptions & {
    enabled?: boolean;
    onOpen?: ConnectionQueryWebSocketHandlers["onOpen"];
    onMessage: (message: ConnectionStreamServerMessage, event: MessageEvent) => void;
    onParseError?: ConnectionQueryWebSocketHandlers["onParseError"];
    onError?: ConnectionQueryWebSocketHandlers["onError"];
    onClose?: ConnectionQueryWebSocketHandlers["onClose"];
  },
) {
  const handlersRef = useRef(options);
  handlersRef.current = options;

  const stableRequest = JSON.stringify(request ?? null);
  const stableProtocols = JSON.stringify(options.protocols ?? null);

  useEffect(() => {
    if (!request?.connectionId || options.enabled === false) {
      return undefined;
    }

    let disposed = false;
    let subscription: { close: (code?: number, reason?: string) => void } | null = null;

    void createAuthenticatedConnectionQueryWebSocketSubscription(
      request,
      {
        onOpen: (event) => handlersRef.current.onOpen?.(event),
        onMessage: (message, event) => handlersRef.current.onMessage(message, event),
        onParseError: (error, event) => handlersRef.current.onParseError?.(error, event),
        onError: (event) => handlersRef.current.onError?.(event),
        onClose: (event) => handlersRef.current.onClose?.(event),
      },
      {
        apiBaseUrl: options.apiBaseUrl,
        protocols: options.protocols,
        queryModel: options.queryModel,
        webSocketFactory: options.webSocketFactory,
        ticketAudience: options.ticketAudience,
        ticketProvider: options.ticketProvider,
      },
    )
      .then((nextSubscription) => {
        if (disposed) {
          nextSubscription.close(1000, "connection query WebSocket hook disposed before open");
          return;
        }

        subscription = nextSubscription;
      })
      .catch((error) => {
        if (disposed) {
          return;
        }

        handlersRef.current.onError?.({
          type: "error",
          error,
        } as unknown as Event);
      });

    return () => {
      disposed = true;
      subscription?.close();
    };
  }, [
    options.apiBaseUrl,
    options.enabled,
    options.queryModel,
    options.ticketAudience,
    options.ticketProvider,
    options.webSocketFactory,
    request?.connectionId,
    stableProtocols,
    stableRequest,
  ]);
}
