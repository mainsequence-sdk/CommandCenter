import { titleCase } from "@/lib/utils";
import type { WidgetRailSummaryComponentProps } from "@/widgets/types";

import {
  buildAppComponentOperationKey,
  normalizeAppComponentProps,
  type AppComponentWidgetProps,
} from "./appComponentModel";

function resolveStatusLabel(runtimeState?: Record<string, unknown>) {
  const status = typeof runtimeState?.status === "string" ? runtimeState.status.trim() : "";

  if (!status) {
    return "Idle";
  }

  return titleCase(status.replaceAll("_", " "));
}

function resolveEndpointLabel(
  props: AppComponentWidgetProps,
  runtimeState?: Record<string, unknown>,
) {
  if (props.method && props.path) {
    return buildAppComponentOperationKey(props.method, props.path);
  }

  if (typeof props.bindingSpec?.operationKey === "string" && props.bindingSpec.operationKey.trim()) {
    return props.bindingSpec.operationKey.trim();
  }

  if (typeof runtimeState?.operationKey === "string" && runtimeState.operationKey.trim()) {
    return runtimeState.operationKey.trim();
  }

  return "Not selected";
}

function splitEndpointLabel(endpointLabel: string) {
  const separatorIndex = endpointLabel.indexOf(" ");

  if (separatorIndex <= 0) {
    return {
      method: null,
      path: endpointLabel,
    };
  }

  return {
    method: endpointLabel.slice(0, separatorIndex).trim() || null,
    path: endpointLabel.slice(separatorIndex + 1).trim() || endpointLabel,
  };
}

function resolveServiceLabel(props: AppComponentWidgetProps) {
  const raw = typeof props.apiBaseUrl === "string" ? props.apiBaseUrl.trim() : "";

  if (!raw) {
    return "Not configured";
  }

  try {
    const url = new URL(raw);
    return url.host || raw;
  } catch {
    return raw;
  }
}

export function AppComponentRailSummary({
  title,
  props,
  runtimeState,
}: WidgetRailSummaryComponentProps<AppComponentWidgetProps>) {
  const normalizedProps = normalizeAppComponentProps(props);
  const statusLabel = resolveStatusLabel(runtimeState);
  const endpointLabel = resolveEndpointLabel(normalizedProps, runtimeState);
  const endpoint = splitEndpointLabel(endpointLabel);
  const serviceLabel = resolveServiceLabel(normalizedProps);

  return (
    <div className="pointer-events-none z-20 w-[248px] rounded-[calc(var(--radius)-4px)] border border-border/80 bg-popover/95 p-3 text-left shadow-xl backdrop-blur-sm">
      <div className="truncate text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">API request widget</div>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium text-foreground">{statusLabel}</span>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Endpoint</div>
          <div
            className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/55 p-2"
            title={endpointLabel}
          >
            <div className="flex items-start gap-2">
              {endpoint.method ? (
                <span className="shrink-0 rounded-full border border-border/70 bg-muted/55 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-foreground">
                  {endpoint.method}
                </span>
              ) : null}
              <span className="min-w-0 break-all font-medium leading-4 text-foreground">
                {endpoint.path}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Service</span>
          <span
            className="max-w-[148px] break-all text-right font-medium text-foreground"
            title={serviceLabel}
          >
            {serviceLabel}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Auth</span>
          <span className="font-medium text-foreground">
            {normalizedProps.authMode === "none" ? "None" : "Session JWT"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Refresh</span>
          <span className="font-medium text-foreground">
            {normalizedProps.refreshOnDashboardRefresh === false ? "Manual" : "Dashboard"}
          </span>
        </div>
      </div>
    </div>
  );
}
