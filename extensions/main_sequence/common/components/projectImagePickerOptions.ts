import type { ProjectImageOption } from "../api";
import type { PickerOption } from "./PickerField";

function formatProjectImageCreatedDisplay(image: ProjectImageOption) {
  const trimmedDisplay = image.creation_date_display?.trim();

  if (trimmedDisplay) {
    return trimmedDisplay;
  }

  if (!image.creation_date) {
    return "";
  }

  const parsed = Date.parse(image.creation_date);

  if (Number.isNaN(parsed)) {
    return image.creation_date;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

export function getProjectImageTags(image: ProjectImageOption) {
  return Array.isArray(image.tags)
    ? image.tags
        .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
        .map((tag) => tag.trim())
    : [];
}

function prioritizeProjectImageTags(tags: string[]) {
  const prioritizedTags = [...tags];
  const msSdkTagIndex = prioritizedTags.findIndex((tag) => tag.toLowerCase().startsWith("ms-sdk"));

  if (msSdkTagIndex > 0) {
    const [msSdkTag] = prioritizedTags.splice(msSdkTagIndex, 1);
    prioritizedTags.unshift(msSdkTag);
  }

  return prioritizedTags;
}

export function formatProjectImagePickerLabel(image: ProjectImageOption) {
  const createdDisplay = formatProjectImageCreatedDisplay(image);

  if (!image.project_repo_hash?.trim()) {
    return createdDisplay ? `Latest -- ${createdDisplay}` : "Latest";
  }

  const shortHash = image.project_repo_hash.slice(0, 7);
  return createdDisplay ? `${shortHash} -- ${createdDisplay}` : shortHash;
}

function formatProjectImageTagSummary(tags: string[]) {
  const prioritizedTags = prioritizeProjectImageTags(tags);

  if (prioritizedTags.length === 0) {
    return "";
  }

  if (prioritizedTags.length <= 3) {
    return prioritizedTags.join(", ");
  }

  return `${prioritizedTags.slice(0, 3).join(", ")} +${prioritizedTags.length - 3} more`;
}

export function formatProjectImagePickerDescription(image: ProjectImageOption) {
  const baseImageTitle = image.base_image?.title?.trim() || "Default base image";
  const tags = getProjectImageTags(image);
  const tagSummary = formatProjectImageTagSummary(tags);
  const prioritizedTags = prioritizeProjectImageTags(tags);
  const primaryTag = prioritizedTags[0] ?? "";

  if (primaryTag.toLowerCase().startsWith("ms-sdk")) {
    const remainingTagCount = prioritizedTags.length - 1;
    return remainingTagCount > 0
      ? `${primaryTag} · +${remainingTagCount} more tags · Base image - ${baseImageTitle}`
      : `${primaryTag} · Base image - ${baseImageTitle}`;
  }

  return tagSummary
    ? `Base image - ${baseImageTitle} · Tags: ${tagSummary}`
    : `Base image - ${baseImageTitle}`;
}

function buildProjectImagePickerKeywords(image: ProjectImageOption, extraKeywords: string[] = []) {
  return [
    String(image.id),
    image.title ?? "",
    image.project_repo_hash ?? "",
    image.base_image?.title ?? "",
    image.base_image?.description ?? "",
    image.creation_date ?? "",
    image.creation_date_display ?? "",
    ...prioritizeProjectImageTags(getProjectImageTags(image)),
    ...extraKeywords,
  ];
}

export function toProjectImagePickerOption(image: ProjectImageOption): PickerOption {
  return {
    value: String(image.id),
    label: formatProjectImagePickerLabel(image),
    description: formatProjectImagePickerDescription(image),
    keywords: buildProjectImagePickerKeywords(image),
  };
}

export function toProjectImageTitlePickerOption(
  image: ProjectImageOption,
  {
    fallbackLabel,
    status,
  }: {
    fallbackLabel?: string;
    status?: string;
  } = {},
): PickerOption {
  return {
    value: String(image.id),
    label: image.title?.trim() || fallbackLabel || `Image ${image.id}`,
    description: [
      formatProjectImagePickerDescription(image),
      formatProjectImagePickerLabel(image),
      status?.trim() || "",
    ]
      .filter(Boolean)
      .join(" · "),
    keywords: buildProjectImagePickerKeywords(image, status ? [status] : []),
  };
}

export function createDynamicProjectImagePickerOption(): PickerOption {
  return {
    value: "",
    label: "Latest commit (dynamic)",
    description: "Uses the latest project state.",
    keywords: ["latest", "dynamic", "current", "head"],
  };
}
