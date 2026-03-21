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
  showHeader?: boolean;
  visible?: boolean;
}

type WorkspaceRowWidgetComponentProps = WidgetComponentProps<WorkspaceRowWidgetProps>;

export function WorkspaceRowWidget({ props }: WorkspaceRowWidgetComponentProps) {
  const { resolvedTokens } = useTheme();
  const visible = props.visible === true;
  const rowColor = normalizeWorkspaceRowColor(props.color) ?? resolvedTokens.primary;

  if (!visible) {
    return null;
  }

  return (
    <div className="w-full overflow-visible">
      <div
        className="h-px w-full"
        style={{
          background: `linear-gradient(90deg, ${withAlpha(rowColor, 0.18)} 0%, ${withAlpha(
            rowColor,
            0.58,
          )} 42%, ${withAlpha(rowColor, 0.78)} 100%)`,
          boxShadow: `0 0 18px ${withAlpha(rowColor, 0.14)}`,
        }}
      />
    </div>
  );
}
