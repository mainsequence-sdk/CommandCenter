import type { ConnectionInstance, ConnectionRef } from "@/connections/types";

const LEGACY_SYNTHETIC_CONNECTION_REF_IDS = new Set([
  "system-default",
  "mainsequence-data-node-default",
  "prometheus-default",
]);

function sameConnectionId(left: ConnectionRef["id"] | undefined, right: ConnectionRef["id"] | undefined) {
  return left !== undefined && right !== undefined && String(left) === String(right);
}

function buildConnectionRef(instance: ConnectionInstance): ConnectionRef {
  return {
    id: instance.id,
    typeId: instance.typeId,
  };
}

function findExactConnectionInstance(
  instances: readonly ConnectionInstance[],
  requestedRef: ConnectionRef | undefined,
) {
  if (!requestedRef) {
    return undefined;
  }

  return instances.find(
    (instance) =>
      sameConnectionId(instance.id, requestedRef.id) && instance.typeId === requestedRef.typeId,
  );
}

export function resolveConnectionRefSelection(input: {
  requestedRef?: ConnectionRef;
  preferredInstance?: ConnectionInstance;
  backendInstances: readonly ConnectionInstance[];
}): {
  connectionRef?: ConnectionRef;
  connectionInstance?: ConnectionInstance;
  repaired: boolean;
} {
  const allInstances = [
    ...(input.preferredInstance ? [input.preferredInstance] : []),
    ...input.backendInstances,
  ];
  const exactMatch = findExactConnectionInstance(allInstances, input.requestedRef);

  if (exactMatch) {
    return {
      connectionRef: buildConnectionRef(exactMatch),
      connectionInstance: exactMatch,
      repaired: false,
    };
  }

  if (!input.requestedRef && input.preferredInstance) {
    return {
      connectionRef: buildConnectionRef(input.preferredInstance),
      connectionInstance: input.preferredInstance,
      repaired: false,
    };
  }

  if (!input.requestedRef?.typeId) {
    return {
      connectionRef: input.requestedRef,
      connectionInstance: undefined,
      repaired: false,
    };
  }

  const typeId = input.requestedRef.typeId;
  const preferredInstanceMatchesType = input.preferredInstance?.typeId === typeId;

  if (preferredInstanceMatchesType && input.preferredInstance) {
    return {
      connectionRef: buildConnectionRef(input.preferredInstance),
      connectionInstance: input.preferredInstance,
      repaired: !sameConnectionId(input.preferredInstance.id, input.requestedRef.id),
    };
  }

  const backendMatches = input.backendInstances.filter((instance) => instance.typeId === typeId);
  const defaultBackendMatch = backendMatches.find((instance) => instance.isDefault);
  const repairedBackendMatch =
    backendMatches.length === 1 ? backendMatches[0] : defaultBackendMatch;

  if (repairedBackendMatch) {
    return {
      connectionRef: buildConnectionRef(repairedBackendMatch),
      connectionInstance: repairedBackendMatch,
      repaired: !sameConnectionId(repairedBackendMatch.id, input.requestedRef.id),
    };
  }

  const requestedId =
    input.requestedRef?.id !== undefined ? String(input.requestedRef.id) : undefined;

  if (requestedId && LEGACY_SYNTHETIC_CONNECTION_REF_IDS.has(requestedId)) {
    return {
      connectionRef: undefined,
      connectionInstance: undefined,
      repaired: true,
    };
  }

  return {
    connectionRef: input.requestedRef,
    connectionInstance: undefined,
    repaired: false,
  };
}
