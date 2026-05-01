import type { ComponentType } from "react";

import type {
  AnyConnectionTypeDefinition,
  ConnectionAuthoringMode,
  ConnectionAuthoringContract,
  ConnectionAuthoringSummaryProps,
  ConnectionInstance,
  ConnectionQueryModel,
} from "@/connections/types";
import { isConnectionQueryModelStreamable } from "@/connections/types";
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
  authoringMode?: ConnectionAuthoringMode;
}): ConnectionQueryModel[] {
  const { authoringMode, connectionInstance, connectionType } = input;
  const queryModels = connectionType?.queryModels ?? [];

  if (!connectionInstance || !connectionType) {
    return queryModels;
  }

  return (
    resolveConnectionAuthoringContract(connectionType)?.resolveQueryModels?.({
      authoringMode,
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

export function resolveConnectionStreamAuthoringQueryModels(input: {
  connectionInstance?: ConnectionInstance;
  connectionType?: AnyConnectionTypeDefinition;
}): ConnectionQueryModel[] {
  return resolveConnectionAuthoringQueryModels({
    ...input,
    authoringMode: "stream",
  }).filter(isConnectionQueryModelStreamable);
}

export function resolveConnectionAuthoringQueryModelsForMode(input: {
  connectionInstance?: ConnectionInstance;
  connectionType?: AnyConnectionTypeDefinition;
  authoringMode?: ConnectionAuthoringMode;
}): ConnectionQueryModel[] {
  const queryModels = resolveConnectionAuthoringQueryModels(input);

  return input.authoringMode === "stream"
    ? queryModels.filter(isConnectionQueryModelStreamable)
    : queryModels;
}

export function resolveConnectionStreamAuthoringCopy(
  connectionType: AnyConnectionTypeDefinition | undefined,
) {
  const contract = resolveConnectionAuthoringContract(connectionType);

  return {
    runButtonLabel: contract?.streamRunButtonLabel ?? "Test stream",
    resultTitle: contract?.streamResultTitle ?? "Stream preview",
    resultDescription:
      contract?.streamResultDescription ??
      "Preview of the latest normalized frame received from the WebSocket stream.",
  };
}

export function buildConnectionQueryDraftSeed(input: {
  connectionInstance: ConnectionInstance;
  connectionType: AnyConnectionTypeDefinition;
  authoringMode?: ConnectionAuthoringMode;
}): ConnectionQueryWidgetProps {
  const { authoringMode = "query", connectionInstance, connectionType } = input;
  const queryModels = resolveConnectionAuthoringQueryModelsForMode({
    connectionInstance,
    connectionType,
    authoringMode,
  });
  const selectedQueryModel = resolveConnectionQueryDraftModel({
    connectionInstance,
    connectionType,
    queryModels,
    fallbackQueryModel: queryModels[0],
  });
  const defaults = resolveConnectionQueryDraftDefaults({
    authoringMode,
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
