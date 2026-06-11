import { getConnectionRuntimeDefinition } from "@/app/registry/connection-runtime";
import type {
  AnyConnectionTypeDefinition,
  ConnectionInstance,
} from "@/connections/types";

const ADAPTER_FROM_API_CONNECTION_TYPE_ID = "command_center.adapter_from_api";

export interface ConnectionIconDescriptor {
  title: string;
  iconUrl?: string;
  imageAlt?: string;
  backgroundColor?: string;
}

type ConnectionIconInstance = Pick<ConnectionInstance, "typeId" | "name" | "publicConfig">;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSafeRemoteIconUrl(value: unknown) {
  const candidate = readString(value);

  if (!candidate) {
    return undefined;
  }

  try {
    const parsed = new URL(candidate);

    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function readSafeIconBackgroundColor(value: unknown) {
  const candidate = readString(value);

  if (!candidate || candidate.length > 80) {
    return undefined;
  }

  if (
    /^#[0-9a-f]{3,8}$/i.test(candidate) ||
    /^rgba?\([\d\s,%.]+\)$/i.test(candidate) ||
    /^hsla?\([\d\s,%.]+deg?[\d\s,%.]*\)$/i.test(candidate) ||
    /^[a-z]+$/i.test(candidate)
  ) {
    return candidate;
  }

  return undefined;
}

function readLogoDescriptor(value: unknown): Omit<ConnectionIconDescriptor, "title"> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const iconUrl = readSafeRemoteIconUrl(value.url);

  if (!iconUrl) {
    return undefined;
  }

  const altText = readString(value.altText);

  return {
    iconUrl,
    imageAlt: altText ? `${altText} logo` : undefined,
    backgroundColor: readSafeIconBackgroundColor(value.backgroundColor),
  };
}

function readAdapterFromApiInstanceBranding(instance: ConnectionIconInstance) {
  if (instance.typeId !== ADAPTER_FROM_API_CONNECTION_TYPE_ID) {
    return undefined;
  }

  const compiledContract = isRecord(instance.publicConfig.compiledContract)
    ? instance.publicConfig.compiledContract
    : undefined;

  if (!compiledContract) {
    return undefined;
  }

  const openapi = isRecord(compiledContract.openapi) ? compiledContract.openapi : undefined;
  const adapter = isRecord(compiledContract.adapter) ? compiledContract.adapter : undefined;
  const logoDescriptor = readLogoDescriptor(openapi?.logo) ?? readLogoDescriptor(adapter?.logo);

  if (!logoDescriptor) {
    return undefined;
  }

  return {
    ...logoDescriptor,
    title:
      readString(openapi?.title) ??
      readString(adapter?.title) ??
      readString(adapter?.id) ??
      instance.name,
  } satisfies ConnectionIconDescriptor;
}

export function resolveConnectionTypeIconDescriptor(
  connection: AnyConnectionTypeDefinition | undefined,
): ConnectionIconDescriptor {
  const runtimeDefinition = getConnectionRuntimeDefinition(connection);
  const title = connection?.title ?? runtimeDefinition?.title ?? connection?.id ?? "Connection";

  return {
    title,
    iconUrl: connection?.iconUrl ?? runtimeDefinition?.iconUrl,
  };
}

export function resolveConnectionInstanceIconDescriptor(
  instance: ConnectionIconInstance,
  connectionType: AnyConnectionTypeDefinition | undefined,
): ConnectionIconDescriptor {
  return (
    readAdapterFromApiInstanceBranding(instance) ??
    resolveConnectionTypeIconDescriptor(connectionType)
  );
}
