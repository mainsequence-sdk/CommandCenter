import type {
  DynamicTableDataSourceOption,
  ProjectDataSourceRelatedResourceOption,
} from "../api";
import type { PickerOption } from "./PickerField";
import { resolvePhysicalDataSourceIcon } from "./physicalDataSourceIcons";

type DynamicTableRelatedResource = NonNullable<DynamicTableDataSourceOption["related_resource"]> & {
  source_logo?: string | null;
};

function clean(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" ? value.trim() : "";
}

function joinDescription(...values: Array<string | null | undefined>) {
  return values.map(clean).filter(Boolean).join(" · ") || undefined;
}

function buildDataSourcePickerOption({
  classType,
  fallbackValue,
  label,
  sourceLogo,
  status,
  value,
  extraKeywords = [],
}: {
  classType?: string | null;
  fallbackValue: string;
  label?: string | null;
  sourceLogo?: string | null;
  status?: string | null;
  value?: string | null;
  extraKeywords?: Array<string | number | null | undefined>;
}): PickerOption {
  const resolvedValue = clean(value) || fallbackValue;
  const resolvedLabel = clean(label) || `Data source ${resolvedValue}`;
  const resolvedClassType = clean(classType);
  const resolvedStatus = clean(status);

  return {
    value: resolvedValue,
    label: resolvedLabel,
    description: joinDescription(resolvedClassType, resolvedStatus),
    keywords: [
      resolvedValue,
      resolvedLabel,
      resolvedClassType,
      resolvedStatus,
      ...extraKeywords.map(clean),
    ],
    image: resolvePhysicalDataSourceIcon({
      classType: resolvedClassType,
      sourceLogo,
    }),
    imageAlt: `${resolvedLabel} data source`,
    fallbackIcon: "database",
  };
}

export function toProjectDataSourcePickerOption(
  option: DynamicTableDataSourceOption,
): PickerOption {
  const relatedResource = option.related_resource as DynamicTableRelatedResource | null;
  const classType =
    clean(option.related_resource_class_type) || clean(relatedResource?.class_type);
  const label =
    clean(relatedResource?.display_name) ||
    clean(relatedResource?.name) ||
    clean(option.uid) ||
    clean(option.id);

  return buildDataSourcePickerOption({
    value: option.uid,
    fallbackValue: clean(option.id) || clean(option.uid),
    label,
    classType,
    status: relatedResource?.status,
    sourceLogo: relatedResource?.source_logo,
    extraKeywords: [
      option.id,
      option.uid,
      relatedResource?.display_name,
      relatedResource?.name,
      relatedResource?.uid,
      relatedResource?.status,
    ],
  });
}

export function toPhysicalDataSourcePickerOption(
  option: ProjectDataSourceRelatedResourceOption,
): PickerOption {
  const value = clean(option.uid) || clean(option.id);

  return buildDataSourcePickerOption({
    value,
    fallbackValue: value,
    label: option.label,
    classType: option.class_type,
    status: option.status,
    sourceLogo: option.source_logo,
    extraKeywords: [
      option.id,
      option.uid,
      option.label,
      option.class_type,
      option.status,
    ],
  });
}
