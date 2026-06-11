import type { ConnectionInstance } from "@/connections/types";

export const MAIN_SEQUENCE_MARKETS_APP_ID = "main_sequence_markets";
export const MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE = "primary-api";
export const MAIN_SEQUENCE_MARKETS_API_CONNECTION_TYPE_ID =
  "command_center.adapter_from_api";
const MAIN_SEQUENCE_MARKETS_API_CONNECTION_SESSION_KEY =
  "command_center.main_sequence_markets.api_connection.v1";

type MainSequenceApplicationBinding = {
  appId?: unknown;
  role?: unknown;
};

export type MainSequenceMarketsApiConnectionResolution =
  | {
      status: "unconfigured";
      connection: null;
      connections: [];
    }
  | {
      status: "resolved";
      connection: ConnectionInstance;
      connections: [ConnectionInstance];
    }
  | {
      status: "duplicate";
      connection: null;
      connections: ConnectionInstance[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMainSequenceMarketsApiBinding(value: unknown): value is MainSequenceApplicationBinding {
  return (
    isRecord(value) &&
    value.appId === MAIN_SEQUENCE_MARKETS_APP_ID &&
    value.role === MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE
  );
}

export function isMainSequenceMarketsApiConnection(connection: ConnectionInstance): boolean {
  const publicConfig = isRecord(connection.publicConfig) ? connection.publicConfig : {};
  const applicationBindings = publicConfig.applicationBindings;

  return (
    connection.typeId === MAIN_SEQUENCE_MARKETS_API_CONNECTION_TYPE_ID &&
    Array.isArray(applicationBindings) &&
    applicationBindings.some(isMainSequenceMarketsApiBinding)
  );
}

function isUsableMainSequenceMarketsApiConnection(connection: ConnectionInstance): boolean {
  return connection.isActive !== false && isMainSequenceMarketsApiConnection(connection);
}

export function resolveMainSequenceMarketsApiConnection(
  connections: ConnectionInstance[],
): MainSequenceMarketsApiConnectionResolution {
  const matchingConnections = connections.filter(isUsableMainSequenceMarketsApiConnection);

  if (matchingConnections.length === 0) {
    return {
      status: "unconfigured",
      connection: null,
      connections: [],
    };
  }

  if (matchingConnections.length === 1) {
    return {
      status: "resolved",
      connection: matchingConnections[0]!,
      connections: [matchingConnections[0]!],
    };
  }

  return {
    status: "duplicate",
    connection: null,
    connections: matchingConnections,
  };
}

function readBrowserSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readMainSequenceMarketsApiConnectionSessionCache(): ConnectionInstance | null {
  const storage = readBrowserSessionStorage();

  if (!storage) {
    return null;
  }

  const serialized = storage.getItem(MAIN_SEQUENCE_MARKETS_API_CONNECTION_SESSION_KEY);

  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;

    if (
      isRecord(parsed) &&
      isUsableMainSequenceMarketsApiConnection(parsed as unknown as ConnectionInstance)
    ) {
      return parsed as unknown as ConnectionInstance;
    }
  } catch {
    // Fall through and clear malformed cache entries.
  }

  storage.removeItem(MAIN_SEQUENCE_MARKETS_API_CONNECTION_SESSION_KEY);
  return null;
}

export function writeMainSequenceMarketsApiConnectionSessionCache(
  connection: ConnectionInstance,
) {
  const storage = readBrowserSessionStorage();

  if (!storage || !isUsableMainSequenceMarketsApiConnection(connection)) {
    return;
  }

  try {
    storage.setItem(
      MAIN_SEQUENCE_MARKETS_API_CONNECTION_SESSION_KEY,
      JSON.stringify(connection),
    );
  } catch {
    // Session caching is a fast-path optimization; failed writes should not block requests.
  }
}

export function clearMainSequenceMarketsApiConnectionSessionCache() {
  const storage = readBrowserSessionStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(MAIN_SEQUENCE_MARKETS_API_CONNECTION_SESSION_KEY);
}
