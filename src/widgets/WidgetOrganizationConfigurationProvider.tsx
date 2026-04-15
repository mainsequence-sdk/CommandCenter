import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/auth/auth-store";
import {
  fetchOrganizationWidgetTypeConfigurations,
  hasConfiguredOrganizationWidgetTypeConfigurationsEndpoint,
  type OrganizationWidgetTypeConfigurationRecord,
} from "@/widgets/organization-config-api";
import type {
  WidgetDefinition,
  WidgetOrganizationConfigurationContract,
} from "@/widgets/types";

interface WidgetOrganizationConfigurationContextValue {
  records: OrganizationWidgetTypeConfigurationRecord[];
  recordsByWidgetId: Map<string, OrganizationWidgetTypeConfigurationRecord>;
  isLoading: boolean;
  error: string | null;
}

const WidgetOrganizationConfigurationContext =
  createContext<WidgetOrganizationConfigurationContextValue>({
    records: [],
    recordsByWidgetId: new Map(),
    isLoading: false,
    error: null,
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mergeJsonRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...base,
  };

  Object.entries(override).forEach(([key, overrideValue]) => {
    const baseValue = result[key];

    if (isRecord(baseValue) && isRecord(overrideValue)) {
      result[key] = mergeJsonRecords(baseValue, overrideValue);
      return;
    }

    result[key] = overrideValue;
  });

  return result;
}

function cloneConfig(config: Record<string, unknown> | undefined) {
  return config ? (JSON.parse(JSON.stringify(config)) as Record<string, unknown>) : undefined;
}

export function resolveWidgetOrganizationConfiguration(
  contract: WidgetOrganizationConfigurationContract | undefined,
  overrideConfig: Record<string, unknown> | undefined,
) {
  const defaultConfig = cloneConfig(contract?.defaultConfig);

  if (!contract) {
    return null;
  }

  if (!overrideConfig) {
    return defaultConfig ?? {};
  }

  if (!defaultConfig) {
    return cloneConfig(overrideConfig) ?? {};
  }

  return mergeJsonRecords(defaultConfig, overrideConfig);
}

export function WidgetOrganizationConfigurationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const enabled =
    hasConfiguredOrganizationWidgetTypeConfigurationsEndpoint() && Boolean(sessionUserId);
  const query = useQuery({
    queryKey: ["widget-organization-configurations", sessionUserId],
    queryFn: () => fetchOrganizationWidgetTypeConfigurations(),
    enabled,
    staleTime: 60_000,
  });

  const records = query.data ?? [];
  const recordsByWidgetId = useMemo(() => {
    const nextMap = new Map<string, OrganizationWidgetTypeConfigurationRecord>();

    records.forEach((record) => {
      nextMap.set(record.registeredWidgetTypeWidgetId, record);
    });

    return nextMap;
  }, [records]);
  const value = useMemo<WidgetOrganizationConfigurationContextValue>(
    () => ({
      records,
      recordsByWidgetId,
      isLoading: enabled ? query.isLoading : false,
      error: query.error instanceof Error ? query.error.message : null,
    }),
    [enabled, query.error, query.isLoading, records, recordsByWidgetId],
  );

  return (
    <WidgetOrganizationConfigurationContext.Provider value={value}>
      {children}
    </WidgetOrganizationConfigurationContext.Provider>
  );
}

export function useWidgetOrganizationConfigurationRecord(widgetId?: string | null) {
  const context = useContext(WidgetOrganizationConfigurationContext);
  const record = widgetId ? (context.recordsByWidgetId.get(widgetId) ?? null) : null;

  return {
    record,
    isLoading: context.isLoading,
    error: context.error,
  };
}

export function useResolvedWidgetOrganizationConfiguration(
  widget: Pick<WidgetDefinition, "id" | "organizationConfiguration">,
) {
  const { record, isLoading, error } = useWidgetOrganizationConfigurationRecord(widget.id);
  const resolvedConfig = useMemo(
    () =>
      resolveWidgetOrganizationConfiguration(
        widget.organizationConfiguration,
        record?.configJson,
      ),
    [record?.configJson, widget.organizationConfiguration],
  );

  return {
    isSupported: Boolean(widget.organizationConfiguration),
    schema: widget.organizationConfiguration?.schema ?? null,
    version: widget.organizationConfiguration?.version ?? null,
    defaultConfig: widget.organizationConfiguration?.defaultConfig ?? null,
    overrideRecord: record,
    resolvedConfig,
    isLoading: widget.organizationConfiguration ? isLoading : false,
    error: widget.organizationConfiguration ? error : null,
  };
}
