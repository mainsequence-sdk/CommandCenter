import { getConnectionTypeById } from "@/app/registry";
import { ConnectionTypeIcon } from "@/connections/components/ConnectionTypeIcon";
import type { WidgetRailSummaryComponentProps } from "@/widgets/types";

import {
  normalizeConnectionQueryProps,
  type ConnectionQueryWidgetProps,
} from "./connectionQueryModel";

function resolveStatusLabel(runtimeState?: Record<string, unknown>) {
  const status = typeof runtimeState?.status === "string" ? runtimeState.status.trim() : "";

  if (!status) {
    return "Idle";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ConnectionQueryRailSummary({
  title,
  props,
  runtimeState,
}: WidgetRailSummaryComponentProps<ConnectionQueryWidgetProps>) {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const connectionType = normalizedProps.connectionRef?.typeId
    ? getConnectionTypeById(normalizedProps.connectionRef.typeId)
    : undefined;
  const queryModel = normalizedProps.queryModelId
    ? connectionType?.queryModels?.find((model) => model.id === normalizedProps.queryModelId)
    : undefined;
  const connectionTitle = connectionType?.title ?? normalizedProps.connectionRef?.typeId ?? "Not selected";
  const connectionUid = normalizedProps.connectionRef?.uid ?? "Not selected";

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
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium text-foreground">{resolveStatusLabel(runtimeState)}</span>
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
          <span className="text-muted-foreground">UID</span>
          <span
            className="max-w-[150px] truncate text-right font-mono text-[11px] text-foreground"
            title={connectionUid}
          >
            {connectionUid}
          </span>
        </div>
      </div>
    </div>
  );
}
