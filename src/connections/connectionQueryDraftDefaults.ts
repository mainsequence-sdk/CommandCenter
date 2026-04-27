import type {
  AnyConnectionTypeDefinition,
  ConnectionInstance,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
  ConnectionQueryModel,
} from "@/connections/types";

export function buildDefaultQueryForModel(model: ConnectionQueryModel | undefined) {
  if (!model) {
    return {};
  }

  return {
    ...(model.defaultQuery ?? {}),
    kind: model.id,
  };
}

export function resolveConnectionQueryDraftDefaults(input: {
  connectionInstance?: ConnectionInstance;
  connectionType?: AnyConnectionTypeDefinition;
  queryModels: ConnectionQueryModel[];
  selectedQueryModel?: ConnectionQueryModel;
}): ConnectionQueryDraftDefaults {
  const { connectionInstance, connectionType, queryModels, selectedQueryModel } = input;

  if (!connectionInstance || !connectionType) {
    return {};
  }

  const resolverInput: ConnectionQueryDraftDefaultsResolverInput = {
    connectionInstance,
    connectionType,
    queryModels,
    selectedQueryModel,
  };
  const resolved = connectionType.authoringContract?.resolveDraftDefaults?.(resolverInput) ?? {};
  const resolvedQueryModel =
    (resolved.queryModelId
      ? queryModels.find((model) => model.id === resolved.queryModelId)
      : undefined) ?? selectedQueryModel;

  return {
    ...resolved,
    queryModelId: resolvedQueryModel?.id ?? resolved.queryModelId,
    query: resolved.query ?? buildDefaultQueryForModel(resolvedQueryModel),
  };
}

export function resolveConnectionQueryDraftModel(input: {
  connectionInstance?: ConnectionInstance;
  connectionType?: AnyConnectionTypeDefinition;
  queryModels: ConnectionQueryModel[];
  fallbackQueryModel?: ConnectionQueryModel;
}): ConnectionQueryModel | undefined {
  const { connectionInstance, connectionType, fallbackQueryModel, queryModels } = input;
  const resolvedDefaults = resolveConnectionQueryDraftDefaults({
    connectionInstance,
    connectionType,
    queryModels,
  });

  if (resolvedDefaults.queryModelId) {
    const resolvedQueryModel = queryModels.find(
      (model) => model.id === resolvedDefaults.queryModelId,
    );

    if (resolvedQueryModel) {
      return resolvedQueryModel;
    }
  }

  return fallbackQueryModel;
}
