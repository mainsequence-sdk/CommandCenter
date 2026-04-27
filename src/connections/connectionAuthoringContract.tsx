import type { ComponentType } from "react";

import type {
  AnyConnectionTypeDefinition,
  ConnectionAuthoringContract,
  ConnectionAuthoringSummaryProps,
  ConnectionInstance,
  ConnectionQueryModel,
} from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

import {
  buildDefaultQueryForModel,
  resolveConnectionQueryDraftDefaults,
  resolveConnectionQueryDraftModel,
} from "./connectionQueryDraftDefaults";

export function buildRelativeFixedRange(durationMs: number) {
  const fixedEndMs = Date.now();
  const fixedStartMs = fixedEndMs - durationMs;

  return { fixedStartMs, fixedEndMs };
}

export function resolveConnectionAuthoringContract(
  connectionType: AnyConnectionTypeDefinition | undefined,
): ConnectionAuthoringContract | undefined {
  return connectionType?.authoringContract;
}

export function resolveConnectionAuthoringQueryModels(input: {
  connectionInstance?: ConnectionInstance;
  connectionType?: AnyConnectionTypeDefinition;
}): ConnectionQueryModel[] {
  const { connectionInstance, connectionType } = input;
  const queryModels = connectionType?.queryModels ?? [];

  if (!connectionInstance || !connectionType) {
    return queryModels;
  }

  return (
    resolveConnectionAuthoringContract(connectionType)?.resolveQueryModels?.({
      connectionInstance,
      connectionType,
      queryModels,
    }) ?? queryModels
  );
}

export function resolveConnectionAuthoringSummaryComponent(
  connectionType: AnyConnectionTypeDefinition | undefined,
) {
  return resolveConnectionAuthoringContract(connectionType)?.SummaryComponent as
    | ComponentType<ConnectionAuthoringSummaryProps>
    | undefined;
}

export function buildConnectionQueryDraftSeed(input: {
  connectionInstance: ConnectionInstance;
  connectionType: AnyConnectionTypeDefinition;
}): ConnectionQueryWidgetProps {
  const { connectionInstance, connectionType } = input;
  const queryModels = resolveConnectionAuthoringQueryModels({
    connectionInstance,
    connectionType,
  });
  const selectedQueryModel = resolveConnectionQueryDraftModel({
    connectionInstance,
    connectionType,
    queryModels,
    fallbackQueryModel: queryModels[0],
  });
  const defaults = resolveConnectionQueryDraftDefaults({
    connectionInstance,
    connectionType,
    queryModels,
    selectedQueryModel,
  });

  return {
    connectionRef: {
      id: connectionInstance.id,
      typeId: connectionInstance.typeId,
    },
    queryModelId: selectedQueryModel?.id,
    query: selectedQueryModel
      ? defaults.query ?? buildDefaultQueryForModel(selectedQueryModel)
      : {},
    timeRangeMode: selectedQueryModel?.timeRangeAware ? "fixed" : "none",
    fixedStartMs: defaults.fixedStartMs,
    fixedEndMs: defaults.fixedEndMs,
    maxRows: defaults.maxRows,
  };
}
