import type { AnyConnectionTypeDefinition } from "@/connections/types";

const customConnectionModules = import.meta.glob(
  "../../../connections/*/index.ts",
  { eager: true },
);
const extensionConnectionModules = import.meta.glob(
  [
    "../../../extensions/*/connections/*.ts",
    "../../../extensions/*/extensions/*/connections/*.ts",
    "../../extensions/*/connections/*.ts",
    "../../extensions/*/extensions/*/connections/*.ts",
  ],
  { eager: true },
);

function isConnectionDefinition(value: unknown): value is AnyConnectionTypeDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AnyConnectionTypeDefinition>;
  return typeof candidate.id === "string" && typeof candidate.version === "number";
}

function readConnectionModule(module: unknown): AnyConnectionTypeDefinition[] {
  const candidate =
    (module as { default?: unknown; connections?: unknown }).default ??
    (module as { connections?: unknown }).connections;

  if (Array.isArray(candidate)) {
    return candidate.filter(isConnectionDefinition);
  }

  if (
    candidate &&
    typeof candidate === "object" &&
    Array.isArray((candidate as { connections?: unknown }).connections)
  ) {
    return (candidate as { connections: unknown[] }).connections.filter(isConnectionDefinition);
  }

  if (isConnectionDefinition(candidate)) {
    return [candidate];
  }

  return Object.values(module as Record<string, unknown>).filter(isConnectionDefinition);
}

function normalizeConnectionRuntimeKey(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

export const connectionRuntimeDefinitions = [
  ...Object.values(customConnectionModules).flatMap(readConnectionModule),
  ...Object.values(extensionConnectionModules).flatMap(readConnectionModule),
];

export function getConnectionRuntimeDefinition(
  connection: Pick<AnyConnectionTypeDefinition, "id" | "source" | "title"> | string | undefined,
) {
  if (!connection) {
    return undefined;
  }

  if (typeof connection === "string") {
    const id = normalizeConnectionRuntimeKey(connection);
    return connectionRuntimeDefinitions.find((definition) => {
      const definitionId = normalizeConnectionRuntimeKey(definition.id);
      return (
        definitionId === id ||
        definitionId.startsWith(id) ||
        id.startsWith(definitionId)
      );
    });
  }

  const exactMatch = connectionRuntimeDefinitions.find(
    (definition) =>
      normalizeConnectionRuntimeKey(definition.id) === normalizeConnectionRuntimeKey(connection.id),
  );

  if (exactMatch) {
    return exactMatch;
  }

  const backendId = normalizeConnectionRuntimeKey(connection.id);
  const backendSource = normalizeConnectionRuntimeKey(connection.source);
  const backendTitle = normalizeConnectionRuntimeKey(connection.title);

  return connectionRuntimeDefinitions.find((definition) => {
    const localId = normalizeConnectionRuntimeKey(definition.id);
    const localSource = normalizeConnectionRuntimeKey(definition.source);
    const localTitle = normalizeConnectionRuntimeKey(definition.title);

    return (
      localId.startsWith(backendId) ||
      backendId.startsWith(localId) ||
      (backendSource && localSource === backendSource && localTitle === backendTitle)
    );
  });
}

export function hydrateConnectionRuntime(
  connection: AnyConnectionTypeDefinition,
): AnyConnectionTypeDefinition {
  const runtimeDefinition = getConnectionRuntimeDefinition(connection);

  if (!runtimeDefinition) {
    return connection;
  }

  const shouldUseRuntimeConfig =
    Boolean(runtimeDefinition.configEditor) ||
    runtimeDefinition.version >= connection.version;

  return {
    ...connection,
    iconUrl: connection.iconUrl ?? runtimeDefinition.iconUrl,
    publicConfigSchema: shouldUseRuntimeConfig
      ? runtimeDefinition.publicConfigSchema
      : connection.publicConfigSchema,
    secureConfigSchema: shouldUseRuntimeConfig
      ? runtimeDefinition.secureConfigSchema
      : connection.secureConfigSchema,
    configEditor: runtimeDefinition.configEditor,
    queryEditor: runtimeDefinition.queryEditor,
    exploreComponent: runtimeDefinition.exploreComponent,
  };
}
