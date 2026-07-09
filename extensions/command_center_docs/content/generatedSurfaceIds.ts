import type { AppSurfaceDefinition } from "@/apps/types";

export function normalizeDocumentationShellPart(value: string) {
  return value
    .trim()
    .replace(/[\\/]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function getSectionRelativeSurfaceId(surfaceId: string, sectionId: string) {
  const normalizedSurfaceId = normalizeDocumentationShellPart(surfaceId);
  const normalizedSectionId = normalizeDocumentationShellPart(sectionId);

  if (!normalizedSurfaceId || !normalizedSectionId) {
    return normalizedSurfaceId;
  }

  if (normalizedSurfaceId === normalizedSectionId) {
    return "";
  }

  const sectionPrefix = `${normalizedSectionId}.`;

  if (normalizedSurfaceId.startsWith(sectionPrefix)) {
    return normalizedSurfaceId.slice(sectionPrefix.length);
  }

  return normalizedSurfaceId;
}

export function createGeneratedSurfacePageId(sectionId: string, surface: AppSurfaceDefinition) {
  const normalizedSectionId = normalizeDocumentationShellPart(sectionId);
  const sourceSectionId = surface.navigationSection?.id;

  if (!sourceSectionId) {
    const surfaceId = normalizeDocumentationShellPart(surface.id);
    return surfaceId ? `${normalizedSectionId}.${surfaceId}` : normalizedSectionId;
  }

  const normalizedSourceSectionId = normalizeDocumentationShellPart(sourceSectionId);
  const relativeSurfaceId = getSectionRelativeSurfaceId(surface.id, normalizedSourceSectionId);

  return relativeSurfaceId
    ? `${normalizedSectionId}.${normalizedSourceSectionId}.${relativeSurfaceId}`
    : `${normalizedSectionId}.${normalizedSourceSectionId}`;
}

export function createGeneratedSurfaceGroupId(sectionId: string, sourceSectionId: string) {
  return `${normalizeDocumentationShellPart(sectionId)}.${normalizeDocumentationShellPart(
    sourceSectionId,
  )}`;
}
