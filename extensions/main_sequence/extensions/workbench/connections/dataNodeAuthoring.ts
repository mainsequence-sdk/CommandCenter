import { buildRelativeFixedRange } from "@/connections/connectionAuthoringContract";
import { buildDefaultQueryForModel } from "@/connections/connectionQueryDraftDefaults";
import type {
  ConnectionAuthoringContract,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
} from "@/connections/types";

const DATA_NODE_DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;
const DATA_NODE_DEFAULT_MAX_ROWS = 1_000;

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

export function resolveDataNodeDraftDefaults(
  input: ConnectionQueryDraftDefaultsResolverInput,
): ConnectionQueryDraftDefaults {
  const selectedQueryModel =
    input.selectedQueryModel ??
    input.queryModels.find((model) => model.id === "data-node-rows-between-dates") ??
    input.queryModels[0];

  if (!selectedQueryModel) {
    return {};
  }

  const defaultRange = buildRelativeFixedRange(DATA_NODE_DEFAULT_RANGE_MS);
  const defaultLimit =
    normalizePositiveInteger(input.connectionInstance.publicConfig.defaultLimit) ??
    DATA_NODE_DEFAULT_MAX_ROWS;

  return {
    queryModelId: selectedQueryModel.id,
    query: buildDefaultQueryForModel(selectedQueryModel),
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
    maxRows: defaultLimit,
  };
}

export const dataNodeConnectionAuthoringContract: ConnectionAuthoringContract = {
  resolveDraftDefaults: resolveDataNodeDraftDefaults,
  exploreTitle: "Data Node Query Explore",
  exploreDescription:
    "Runs the same generated connection query request as the workspace Connection Query widget.",
  exploreRunButtonLabel: "Run query",
  exploreResultDescription: "Preview of the normalized widget runtime frame.",
};
