import { queryConnection, testConnection } from "@/connections/api";
import type { DashboardRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  ConnectionHealthResult,
  ConnectionInstance,
  ConnectionQueryRequest,
  ConnectionQueryResponse,
} from "@/connections/types";

import {
  isAdapterFromApiDirectConnectionInstance,
  queryAdapterFromApiDirect,
  testAdapterFromApiDirect,
} from "../../connections/adapter-from-api/directTransport";

export async function executeConnectionQuery<
  TQuery = Record<string, unknown>,
  TResponse = ConnectionQueryResponse,
>(
  request: ConnectionQueryRequest<TQuery>,
  options?: {
    connectionInstance?: ConnectionInstance;
    traceMeta?: DashboardRequestTraceMeta;
    signal?: AbortSignal;
  },
) {
  const directConnectionInstance = options?.connectionInstance;

  if (
    directConnectionInstance &&
    isAdapterFromApiDirectConnectionInstance(directConnectionInstance)
  ) {
    return queryAdapterFromApiDirect(
      directConnectionInstance,
      request as unknown as Parameters<typeof queryAdapterFromApiDirect>[1],
      { signal: options?.signal },
    ) as Promise<TResponse>;
  }

  return queryConnection<TQuery, TResponse>(request, options?.traceMeta, {
    signal: options?.signal,
  });
}

export async function testConnectionInstance(
  instance: ConnectionInstance,
  options?: {
    signal?: AbortSignal;
  },
): Promise<ConnectionHealthResult> {
  if (isAdapterFromApiDirectConnectionInstance(instance)) {
    return testAdapterFromApiDirect(instance, { signal: options?.signal });
  }

  return testConnection(instance.id);
}
