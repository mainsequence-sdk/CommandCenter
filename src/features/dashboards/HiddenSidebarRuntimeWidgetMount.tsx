import { useMemo, type ComponentType } from "react";

import {
  useDashboardWidgetDependencies,
} from "@/dashboards/DashboardWidgetDependenciesContext";
import type { DashboardWidgetDependencyModel } from "@/dashboards/widget-dependencies";
import {
  resolveReferenceBackedWidgetState,
  resolveWidgetReferenceBaseProps,
} from "@/dashboards/widget-instance-references";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  isManagedConnectionConsumerStreamMode,
  normalizeManagedConnectionEmbeddedSourceProps,
  resolveManagedConnectionConsumerSourceWidgetId,
} from "@/widgets/shared/managed-connection-consumer";
import { getManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer-registry";
import { WidgetErrorBoundary } from "@/widgets/shared/widget-error-boundary";
import type {
  ResolvedWidgetInputs,
  WidgetComponentProps,
  WidgetDefinition,
} from "@/widgets/types";

const CONNECTION_STREAM_QUERY_WIDGET_ID = "connection-stream-query";
// Temporary stream diagnostics are disabled by default to avoid console spam.
const HIDDEN_STREAM_MOUNT_DEBUG_LOGS_ENABLED = false;

export interface HiddenRuntimeWidgetMountState {
  props: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
}

function summarizeResolvedInputs(resolvedInputs: ResolvedWidgetInputs | undefined) {
  return Object.fromEntries(
    Object.entries(resolvedInputs ?? {}).map(([inputId, resolved]) => {
      const entries = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];

      return [
        inputId,
        entries.map((entry) => ({
          status: entry.status,
          sourceWidgetId: entry.sourceWidgetId,
          sourceOutputId: entry.sourceOutputId,
          value: entry.value,
        })),
      ];
    }),
  );
}

function resolveManagedStreamSourceProps(input: {
  dependencyModel: DashboardWidgetDependencyModel | null | undefined;
  instance: DashboardWidgetInstance;
}) {
  const { dependencyModel, instance } = input;

  if (
    !dependencyModel ||
    instance.managedBy?.role !== "embedded-connection-source" ||
    instance.widgetId !== CONNECTION_STREAM_QUERY_WIDGET_ID
  ) {
    return null;
  }

  const owner = dependencyModel.entries.find(
    (entry) => entry.instance.id === instance.managedBy?.ownerInstanceId,
  )?.instance;

  if (!owner) {
    return null;
  }

  const adapter = getManagedConnectionConsumerAdapter(owner.widgetId);

  if (!adapter) {
    return null;
  }

  const ownerBaseProps = resolveWidgetReferenceBaseProps(owner);
  const ownerEffectiveState = resolveReferenceBackedWidgetState({
    instanceTitle: owner.title,
    props: ownerBaseProps,
    resolvedInputs: dependencyModel.resolveInputs(owner.id),
  });
  const ownerEffectiveProps = ownerEffectiveState.props;
  const sourceMode = adapter.getSourceMode(ownerEffectiveProps);

  if (
    !isManagedConnectionConsumerStreamMode(adapter, sourceMode) ||
    resolveManagedConnectionConsumerSourceWidgetId(adapter, ownerEffectiveProps) !==
      CONNECTION_STREAM_QUERY_WIDGET_ID
  ) {
    return null;
  }

  return normalizeManagedConnectionEmbeddedSourceProps(
    adapter,
    ownerEffectiveProps,
    adapter.getEmbeddedConnectionQuery(ownerBaseProps),
  ) as Record<string, unknown>;
}

export function resolveHiddenSidebarRuntimeWidgetMountState(input: {
  dependencyModel?: DashboardWidgetDependencyModel | null;
  instance: DashboardWidgetInstance;
  widgetId: string;
}): HiddenRuntimeWidgetMountState {
  if (input.widgetId !== CONNECTION_STREAM_QUERY_WIDGET_ID) {
    return {
      props: input.instance.props ?? {},
    };
  }

  const projectedProps = resolveManagedStreamSourceProps({
    dependencyModel: input.dependencyModel,
    instance: input.instance,
  });
  const resolvedInputs = projectedProps
    ? input.dependencyModel?.resolveInputsForInstance({
        ...input.instance,
        props: projectedProps,
      })
    : input.dependencyModel?.resolveInputs(input.instance.id);
  const mountState = {
    props:
      projectedProps ??
      input.instance.props ??
      {},
    resolvedInputs,
  };

  if (import.meta.env.DEV && HIDDEN_STREAM_MOUNT_DEBUG_LOGS_ENABLED) {
    const owner = input.instance.managedBy?.ownerInstanceId
      ? input.dependencyModel?.entries.find(
          (entry) => entry.instance.id === input.instance.managedBy?.ownerInstanceId,
        )?.instance
      : undefined;
    const adapter = owner ? getManagedConnectionConsumerAdapter(owner.widgetId) : null;
    const ownerEffectiveProps = owner
      ? resolveReferenceBackedWidgetState({
          instanceTitle: owner.title,
          props: owner.props ?? {},
          resolvedInputs: input.dependencyModel?.resolveInputs(owner.id),
        }).props
      : undefined;
    const sourceMode = adapter && ownerEffectiveProps
      ? adapter.getSourceMode(ownerEffectiveProps)
      : undefined;

    console.log("[stream-hidden-mount]", {
      instanceId: input.instance.id,
      widgetId: input.widgetId,
      managedBy: input.instance.managedBy,
      ownerInstanceId: owner?.id,
      ownerWidgetId: owner?.widgetId,
      sourceMode,
      isManagedStreamMode: adapter
        ? isManagedConnectionConsumerStreamMode(adapter, sourceMode)
        : false,
      rawPropsQuery: input.instance.props?.query,
      projectedPropsQuery: mountState.props.query,
      resolvedInputIds: Object.keys(resolvedInputs ?? {}).sort(),
      resolvedInputsSummary: summarizeResolvedInputs(resolvedInputs),
    });
  }

  return mountState;
}

export function HiddenSidebarRuntimeWidgetMount({
  instance,
  widget,
  onRuntimeStateChange,
}: {
  instance: DashboardWidgetInstance;
  widget: WidgetDefinition<Record<string, unknown>>;
  onRuntimeStateChange: (state: Record<string, unknown> | undefined) => void;
}) {
  const dependencyModel = useDashboardWidgetDependencies();
  const mountState = useMemo(
    () =>
      resolveHiddenSidebarRuntimeWidgetMountState({
        dependencyModel,
        instance,
        widgetId: widget.id,
      }),
    [dependencyModel, instance, widget.id],
  );
  const Component = widget.component as ComponentType<
    WidgetComponentProps<Record<string, unknown>>
  >;

  return (
    <div className="h-px w-px overflow-hidden">
      <WidgetErrorBoundary
        widgetId={widget.id}
        widgetTitle={instance.title ?? widget.title}
        instanceId={instance.id}
        surface="hidden"
      >
        <Component
          widget={widget}
          instanceId={instance.id}
          instanceTitle={instance.title}
          props={mountState.props}
          presentation={instance.presentation}
          runtimeState={instance.runtimeState}
          resolvedInputs={mountState.resolvedInputs}
          onRuntimeStateChange={onRuntimeStateChange}
        />
      </WidgetErrorBoundary>
    </div>
  );
}
