export interface MainSequenceProjectInfraGraphWidgetProps extends Record<string, unknown> {
  commitSha?: string;
  projectId?: number;
}

export function normalizeProjectInfraGraphProjectId(value: unknown): number | undefined {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.trunc(numericValue)
    : undefined;
}

export function normalizeProjectInfraGraphCommitSha(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function normalizeProjectInfraGraphWidgetProps(
  props: MainSequenceProjectInfraGraphWidgetProps,
): MainSequenceProjectInfraGraphWidgetProps {
  return {
    commitSha: normalizeProjectInfraGraphCommitSha(props.commitSha),
    projectId: normalizeProjectInfraGraphProjectId(props.projectId),
  };
}
