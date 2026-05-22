export interface MainSequenceProjectInfraGraphWidgetProps extends Record<string, unknown> {
  commitSha?: string;
  projectUid?: string;
}

export function normalizeProjectInfraGraphProjectUid(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
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
    projectUid: normalizeProjectInfraGraphProjectUid(props.projectUid),
  };
}
