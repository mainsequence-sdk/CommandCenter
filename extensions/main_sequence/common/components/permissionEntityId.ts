import type { RbacEntityId } from "@/components/ui/rbac-assignment-matrix";

const permissionEntityIdKeys = ["id", "uid", "user_uid", "userUid", "team_uid", "teamUid"] as const;

export function normalizePermissionEntityId(value: unknown): RbacEntityId | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^-?\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);

    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  return trimmed;
}

export function resolvePermissionEntityId(value: unknown): RbacEntityId | null {
  const directId = normalizePermissionEntityId(value);

  if (directId !== null) {
    return directId;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of permissionEntityIdKeys) {
    const candidateId = normalizePermissionEntityId(record[key]);

    if (candidateId !== null) {
      return candidateId;
    }
  }

  return null;
}

export function mergePermissionEntityIds(
  ...lists: ReadonlyArray<ReadonlyArray<unknown>>
): RbacEntityId[] {
  const seen = new Set<string>();
  const ids: RbacEntityId[] = [];

  for (const value of lists.flat()) {
    const id = resolvePermissionEntityId(value);

    if (id === null) {
      continue;
    }

    const key = String(id);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    ids.push(id);
  }

  return ids;
}
