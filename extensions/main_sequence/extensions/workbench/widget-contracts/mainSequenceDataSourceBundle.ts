export const MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT =
  "main_sequence.data_source_bundle@v1" as const;

export interface MainSequenceDataSourceFieldOption {
  key: string;
  label: string;
  dtype?: string | null;
  isTime?: boolean;
  isIndex?: boolean;
  isNumeric?: boolean;
  description?: string | null;
}

export interface MainSequenceDataSourceBundleV1 {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  dataNodeId?: number;
  dateRangeMode?: "dashboard" | "fixed";
  fixedStartMs?: number;
  fixedEndMs?: number;
  uniqueIdentifierList?: string[];
  columns: string[];
  rows: Array<Record<string, unknown>>;
  availableFields?: MainSequenceDataSourceFieldOption[];
}
