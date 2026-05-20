import { createContext, useContext, useEffect, useMemo, useRef } from "react";

import {
  type DashboardExecutionSurface,
  shouldSuppressPassiveUpstreamResolution,
  type DashboardSurfaceHydrationReason,
} from "@/dashboards/dashboard-surface-hydration";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  buildDashboardExecutionRequestTraceMeta,
  type DashboardRequestTraceMeta,
  type DashboardRequestTraceReason,
  type DashboardRequestTraceSource,
} from "@/dashboards/dashboard-request-trace";
import type {
  DashboardUpstreamResolutionRequirement,
  DashboardVariableDrivenCommitPlan,
  DashboardWidgetGraphExecutionResult,
} from "@/dashboards/widget-graph-execution";
import type {
  WidgetExecutionReason,
  WidgetExecutionSurface,
  WidgetExecutionTargetOverrides,
} from "@/widgets/types";

export interface WidgetExecutionState {
  status: "idle" | "running" | "success" | "error";
  reason?: WidgetExecutionReason;
  targetInstanceId?: string;
  startedAtMs?: number;
  finishedAtMs?: number;
  error?: string;
}

export interface ExecuteWidgetGraphOptions {
  reason: WidgetExecutionReason;
  refreshCycleId?: string;
  targetOverrides?: WidgetExecutionTargetOverrides;
  persistTargetRuntimeStateWithOverrides?: boolean;
  sourceBoundaryInstanceId?: string;
  signal?: AbortSignal;
}

export interface ResolveWidgetUpstreamOptions {
  targetOverrides?: WidgetExecutionTargetOverrides;
}

export interface ResolveWidgetUpstreamHookOptions extends ResolveWidgetUpstreamOptions {
  enabled: boolean;
}

interface PassiveUpstreamResolutionOptions extends ResolveWidgetUpstreamOptions {
  settledKey: string;
}

export interface DashboardWidgetFlowExecutionResult {
  status: "success" | "error" | "skipped";
  error?: string;
  widgets: DashboardWidgetInstance[];
  sourceInstanceId: string;
  sourceResult: DashboardWidgetGraphExecutionResult;
  downstreamResults: DashboardWidgetGraphExecutionResult[];
  executedInstanceIds: Set<string>;
}

export interface DashboardVariableDrivenCommitExecutionResult {
  status: "success" | "error" | "skipped";
  error?: string;
  changedWidgetId: string;
  plan: DashboardVariableDrivenCommitPlan;
  widgets: DashboardWidgetInstance[];
  downstreamResults: DashboardWidgetGraphExecutionResult[];
  executedInstanceIds: Set<string>;
}

export interface DashboardWidgetExecutionContextValue {
  scopeId: string;
  activeSurface: DashboardExecutionSurface;
  executionSurface: WidgetExecutionSurface;
  publicWorkspaceToken?: string;
  activeRefreshCycleId?: string;
  initialHydrationActive: boolean;
  dashboardSurfaceHydrationActive: boolean;
  dashboardSurfaceHydrationReason?: DashboardSurfaceHydrationReason;
  getWidgetInstance: (instanceId?: string) => DashboardWidgetInstance | undefined;
  executeWidgetGraph: (
    targetInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) => Promise<DashboardWidgetGraphExecutionResult>;
  executeWidgetFlow: (
    sourceInstanceId: string,
    options: ExecuteWidgetGraphOptions,
  ) => Promise<DashboardWidgetFlowExecutionResult>;
  executeVariableDrivenWidgetCommit: (input: {
    changedWidgetId: string;
    beforeWidgets: DashboardWidgetInstance[];
    afterWidgets: DashboardWidgetInstance[];
    changeOrigin?: "settings" | "runtime";
  }) => Promise<DashboardVariableDrivenCommitExecutionResult>;
  resolveUpstream: (
    targetInstanceId: string,
    options?: ResolveWidgetUpstreamOptions,
  ) => Promise<DashboardWidgetGraphExecutionResult>;
  resolvePassiveUpstream: (
    targetInstanceId: string,
    options: PassiveUpstreamResolutionOptions,
  ) => Promise<void>;
  getExecutionState: (instanceId?: string) => WidgetExecutionState | undefined;
  getUpstreamRequirement: (
    instanceId?: string,
    options?: ResolveWidgetUpstreamOptions,
  ) => DashboardUpstreamResolutionRequirement | undefined;
  publishRuntimeState: (
    instanceId: string,
    runtimeState: Record<string, unknown> | undefined,
  ) => void;
}

export const DashboardWidgetExecutionContext =
  createContext<DashboardWidgetExecutionContextValue | null>(null);

export function useDashboardWidgetExecution() {
  return useContext(DashboardWidgetExecutionContext);
}

export function useResolveWidgetUpstream(
  instanceId: string | undefined,
  options: ResolveWidgetUpstreamHookOptions,
) {
  const context = useDashboardWidgetExecution();
  const lastRequestKeyRef = useRef("");
  const { enabled, targetOverrides } = options;
  const upstreamRequirement = useMemo(
    () => context?.getUpstreamRequirement(instanceId, { targetOverrides }),
    [context, instanceId, targetOverrides],
  );

  useEffect(() => {
    if (!context || !instanceId || !enabled || !upstreamRequirement?.needsResolution) {
      lastRequestKeyRef.current = "";
      return;
    }

    if (
      shouldSuppressPassiveUpstreamResolution({
        dashboardSurfaceHydrationActive:
          context.dashboardSurfaceHydrationActive === true,
      })
    ) {
      lastRequestKeyRef.current = "";
      return;
    }

    const nextRequestKey = `${instanceId}::${upstreamRequirement.settledKey}`;

    if (lastRequestKeyRef.current === nextRequestKey) {
      return;
    }

    lastRequestKeyRef.current = nextRequestKey;
    void context.resolvePassiveUpstream(instanceId, {
      targetOverrides,
      settledKey: upstreamRequirement.settledKey,
    }).catch(() => undefined);
  }, [
    context,
    enabled,
    instanceId,
    targetOverrides,
    upstreamRequirement?.needsResolution,
    upstreamRequirement?.settledKey,
  ]);

  return upstreamRequirement;
}

export function useEnsureWidgetGraphResolved(
  instanceId: string | undefined,
  options: ResolveWidgetUpstreamHookOptions,
) {
  return useResolveWidgetUpstream(instanceId, options);
}

export function useWidgetExecutionState(instanceId?: string) {
  const context = useDashboardWidgetExecution();

  return useMemo(
    () => context?.getExecutionState(instanceId),
    [context, instanceId],
  );
}

export function useDashboardWidgetRequestTraceMeta({
  instanceId,
  reason,
  source = "component",
  widgetId,
}: {
  instanceId?: string;
  reason?: DashboardRequestTraceReason;
  source?: DashboardRequestTraceSource;
  widgetId?: string;
}) {
  const context = useDashboardWidgetExecution();

  return useMemo<DashboardRequestTraceMeta | undefined>(() => {
    if (!context?.scopeId) {
      return undefined;
    }

    return {
      scopeId: context.scopeId,
      refreshCycleId: context.activeRefreshCycleId,
      instanceId,
      widgetId,
      source,
      reason:
        reason ??
        (context.activeRefreshCycleId ? "dashboard-refresh" : "component-query"),
    };
  }, [context?.activeRefreshCycleId, context?.scopeId, instanceId, reason, source, widgetId]);
}

export { buildDashboardExecutionRequestTraceMeta };
