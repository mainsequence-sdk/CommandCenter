import type { DataNodeDetail, DataNodeSummary, EntitySummaryHeader } from "../../../../common/api";
import { resolvePhysicalDataSourceIcon } from "../../../../common/components/physicalDataSourceIcons";

function isEngineSummaryField(field: EntitySummaryHeader["inline_fields"][number]) {
  return field.key === "engine" || field.label.trim().toLowerCase() === "engine";
}

export function resolveDataNodeEngineClassType(
  dataNode?: Pick<DataNodeSummary, "data_source"> | null,
) {
  const canonicalClassType =
    dataNode?.data_source?.related_resource_class_type?.trim() ||
    dataNode?.data_source?.related_resource?.class_type?.trim() ||
    "";

  return canonicalClassType || null;
}

export function isTimescaleDataNodeEngineClassType(classType?: string | null) {
  const normalizedClassType = classType?.trim().toLowerCase() ?? "";

  return normalizedClassType === "timescale_db" || normalizedClassType === "timescale_db_remote";
}

export function buildDataNodeEngineFieldDecoration(
  dataNode?: Pick<DataNodeSummary, "data_source"> | null,
  engineName?: string | null,
) {
  const classType = resolveDataNodeEngineClassType(dataNode);

  if (!classType) {
    return null;
  }

  const image = resolvePhysicalDataSourceIcon({ classType });

  if (!image) {
    return null;
  }

  const trimmedEngineName = engineName?.trim();

  return {
    image,
    image_alt: trimmedEngineName ? `${trimmedEngineName} engine` : "Engine",
  };
}

export function decorateDataNodeSummaryWithEngineIcon<T extends EntitySummaryHeader>(
  summary: T,
  dataNodeDetail?: Pick<DataNodeDetail, "data_source"> | null,
): T {
  const engineField =
    summary.inline_fields.find(isEngineSummaryField) ??
    summary.highlight_fields.find(isEngineSummaryField);
  const engineFieldValue =
    engineField?.value === null || engineField?.value === undefined ? null : String(engineField.value);
  const engineDecoration = buildDataNodeEngineFieldDecoration(dataNodeDetail, engineFieldValue);

  if (!engineDecoration) {
    return summary;
  }

  let summaryChanged = false;
  const inline_fields = summary.inline_fields.map((field) => {
    if (!isEngineSummaryField(field)) {
      return field;
    }

    summaryChanged = true;
    return {
      ...field,
      ...engineDecoration,
    };
  });
  const highlight_fields = summary.highlight_fields.map((field) => {
    if (!isEngineSummaryField(field)) {
      return field;
    }

    summaryChanged = true;
    return {
      ...field,
      ...engineDecoration,
    };
  });

  return summaryChanged
    ? ({
        ...summary,
        inline_fields,
        highlight_fields,
      } as T)
    : summary;
}
