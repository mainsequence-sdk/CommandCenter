import { useMemo } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { WidgetController } from "@/widgets/types";

import { type PickerOption } from "../../../../common/components/PickerField";
import { fetchDataNodeDetail, type DataNodeDetail } from "../../../../common/api";
import {
  normalizeDataNodeVisualizerProps,
  resolveDataNodeVisualizerConfig,
  type DataNodeVisualizerFieldOption,
  type MainSequenceDataNodeVisualizerWidgetProps,
} from "./dataNodeVisualizerModel";

function toFieldPickerOption(field: DataNodeVisualizerFieldOption): PickerOption {
  const metadata = [
    field.dtype,
    field.isTime ? "Time" : null,
    field.isIndex ? "Index" : null,
    field.description ?? null,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return {
    value: field.key,
    label: field.label,
    description: metadata.join(" • ") || undefined,
    keywords: [field.key, field.label, field.dtype ?? "", field.description ?? ""],
  };
}

export interface DataNodeVisualizerControllerContext {
  selectedDataNodeId: number;
  selectedDataNodeDetailQuery: UseQueryResult<DataNodeDetail>;
  resolvedConfig: ReturnType<typeof resolveDataNodeVisualizerConfig>;
  fieldPickerOptions: PickerOption[];
  xAxisOptions: PickerOption[];
  yAxisOptions: PickerOption[];
  groupOptions: PickerOption[];
  hasLoadedDataNodeDetail: boolean;
  hasNoData: boolean;
  supportsUniqueIdentifierList: boolean;
}

export function useDataNodeVisualizerControllerContext({
  props,
}: {
  props: MainSequenceDataNodeVisualizerWidgetProps;
}): DataNodeVisualizerControllerContext {
  const selectedDataNodeId = Number(props.dataNodeId ?? 0);
  const selectedDataNodeDetailQuery = useQuery({
    queryKey: ["main_sequence", "widgets", "data_node_visualizer", "detail", selectedDataNodeId],
    queryFn: () => fetchDataNodeDetail(selectedDataNodeId),
    enabled: Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0,
    staleTime: 300_000,
  });

  const resolvedConfig = useMemo(
    () => resolveDataNodeVisualizerConfig(props, selectedDataNodeDetailQuery.data),
    [props, selectedDataNodeDetailQuery.data],
  );
  const fieldPickerOptions = useMemo<PickerOption[]>(
    () => resolvedConfig.availableFields.map(toFieldPickerOption),
    [resolvedConfig.availableFields],
  );
  const xAxisOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Auto",
        description: "Use the default time field.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const yAxisOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Auto",
        description: "Use the default value field.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );
  const groupOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "No grouping",
        description: "Keep all rows in the same series.",
      },
      ...fieldPickerOptions,
    ],
    [fieldPickerOptions],
  );

  const hasLoadedDataNodeDetail = Boolean(selectedDataNodeDetailQuery.data);
  const hasSourceTableConfiguration = Boolean(
    selectedDataNodeDetailQuery.data?.sourcetableconfiguration,
  );

  return {
    selectedDataNodeId,
    selectedDataNodeDetailQuery,
    resolvedConfig,
    fieldPickerOptions,
    xAxisOptions,
    yAxisOptions,
    groupOptions,
    hasLoadedDataNodeDetail,
    hasNoData: hasLoadedDataNodeDetail && !hasSourceTableConfiguration,
    supportsUniqueIdentifierList: resolvedConfig.supportsUniqueIdentifierList,
  };
}

export const dataNodeVisualizerWidgetController: WidgetController<
  MainSequenceDataNodeVisualizerWidgetProps,
  DataNodeVisualizerControllerContext
> = {
  normalizeProps: (props) => normalizeDataNodeVisualizerProps(props),
  useContext: ({ props }) => useDataNodeVisualizerControllerContext({ props }),
};
