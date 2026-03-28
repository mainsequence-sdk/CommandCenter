import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetComponentProps } from "@/widgets/types";

const hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeWorkspaceRowColor(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : null;
}

export interface WorkspaceRowWidgetProps extends Record<string, unknown> {
  color?: string;
}

type WorkspaceRowWidgetComponentProps = WidgetComponentProps<WorkspaceRowWidgetProps>;

export function WorkspaceRowWidget({
  instanceTitle,
  props,
}: WorkspaceRowWidgetComponentProps) {
  const { resolvedTokens } = useTheme();
  const rowColor = normalizeWorkspaceRowColor(props.color) ?? resolvedTokens.primary;

  return (
    <div className="relative flex h-full min-h-0 items-center px-1.5">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 border-b"
        style={{
          borderColor: withAlpha(rowColor, 0.42),
          boxShadow: `inset 0 -1px 0 ${withAlpha(rowColor, 0.22)}`,
        }}
      />
      <span
        className="relative z-10 truncate text-[10px] font-medium uppercase tracking-[0.15em] text-foreground"
        style={{ color: rowColor }}
      >
        {instanceTitle ?? "Row"}
      </span>
    </div>
  );
}
