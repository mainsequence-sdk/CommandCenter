import { getConnectionTypeById } from "@/app/registry";
import { ConnectionTypeIcon } from "@/connections/components/ConnectionTypeIcon";
import type { WidgetRailSummaryComponentProps } from "@/widgets/types";

import {
  normalizeConnectionStreamQueryProps,
  normalizeConnectionStreamQueryRuntimeState,
  type ConnectionStreamQueryWidgetProps,
} from "./connectionStreamQueryModel";

function formatStatus(value: string | undefined) {
  if (!value?.trim()) {
    return "Idle";
  }

  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ConnectionStreamQueryRailSummary({
  title,
  props,
  runtimeState,
}: WidgetRailSummaryComponentProps<ConnectionStreamQueryWidgetProps>) {
  const normalizedProps = normalizeConnectionStreamQueryProps(props);
  const runtime = normalizeConnectionStreamQueryRuntimeState(runtimeState);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;
  const queryModel = normalizedProps.queryModelId
    ? connectionType?.queryModels?.find((model) => model.id === normalizedProps.queryModelId)
    : undefined;
  const connectionTitle = connectionType?.title ?? normalizedProps.connectionRef?.typeId ?? "Not selected";
  const connectionId = normalizedProps.connectionRef?.id ?? "Not selected";
  const connectionIdLabel = String(connectionId);

  return (
    <div className="pointer-events-none z-20 w-[260px] rounded-[calc(var(--radius)-4px)] border border-border/80 bg-popover/95 p-3 text-left shadow-xl backdrop-blur-sm">
      <div className="flex min-w-0 items-start gap-3">
        <ConnectionTypeIcon
          title={connectionTitle}
          iconUrl={connectionType?.iconUrl}
          className="h-10 w-10 rounded-[calc(var(--radius)-7px)]"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {connectionTitle}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Stream</span>
          <span className="font-medium text-foreground">
            {formatStatus(runtime?.streamStatus)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Path</span>
          <span
            className="max-w-[150px] truncate text-right font-medium text-foreground"
            title={queryModel?.label ?? normalizedProps.queryModelId ?? "Not selected"}
          >
            {queryModel?.label ?? normalizedProps.queryModelId ?? "Not selected"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">ID</span>
          <span
            className="max-w-[150px] truncate text-right font-mono text-[11px] text-foreground"
            title={connectionIdLabel}
          >
            {connectionIdLabel}
          </span>
        </div>
        {runtime?.reconnectAttemptCount ? (
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Retries</span>
            <span className="font-medium text-foreground">
              {runtime.reconnectAttemptCount}
            </span>
          </div>
        ) : null}
        {runtime?.lastDisconnectReason ? (
          <div className="space-y-1 pt-1">
            <div className="text-muted-foreground">Last disconnect</div>
            <div className="line-clamp-2 text-[11px] text-foreground">
              {runtime.lastDisconnectReason}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
