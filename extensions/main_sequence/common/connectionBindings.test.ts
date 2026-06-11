/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";

import type { ConnectionInstance } from "@/connections/types";

import {
  clearMainSequenceMarketsApiConnectionSessionCache,
  isMainSequenceMarketsApiConnection,
  MAIN_SEQUENCE_MARKETS_API_CONNECTION_TYPE_ID,
  MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE,
  MAIN_SEQUENCE_MARKETS_APP_ID,
  readMainSequenceMarketsApiConnectionSessionCache,
  resolveMainSequenceMarketsApiConnection,
  writeMainSequenceMarketsApiConnectionSessionCache,
} from "./connectionBindings";

function connection(
  id: number,
  input?: Partial<ConnectionInstance>,
): ConnectionInstance {
  return {
    id,
    typeId: MAIN_SEQUENCE_MARKETS_API_CONNECTION_TYPE_ID,
    typeVersion: 1,
    name: `Connection ${id}`,
    publicConfig: {},
    secureFields: {},
    status: "ok",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    ...input,
  };
}

function boundConnection(id: number, input?: Partial<ConnectionInstance>) {
  return connection(id, {
    publicConfig: {
      applicationBindings: [
        {
          appId: MAIN_SEQUENCE_MARKETS_APP_ID,
          role: MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE,
        },
      ],
    },
    ...input,
  });
}

describe("Main Sequence Markets connection bindings", () => {
  beforeEach(() => {
    clearMainSequenceMarketsApiConnectionSessionCache();
  });

  it("identifies Adapter From API connections bound to Main Sequence Markets", () => {
    expect(isMainSequenceMarketsApiConnection(boundConnection(1))).toBe(true);
    expect(
      isMainSequenceMarketsApiConnection(
        connection(2, {
          typeId: "command_center.other",
          publicConfig: {
            applicationBindings: [
              {
                appId: MAIN_SEQUENCE_MARKETS_APP_ID,
                role: MAIN_SEQUENCE_MARKETS_API_BINDING_ROLE,
              },
            ],
          },
        }),
      ),
    ).toBe(false);
  });

  it("returns deterministic unconfigured, resolved, and duplicate states", () => {
    expect(resolveMainSequenceMarketsApiConnection([connection(1)]).status).toBe(
      "unconfigured",
    );

    const resolved = resolveMainSequenceMarketsApiConnection([
      connection(1),
      boundConnection(2),
    ]);
    expect(resolved.status).toBe("resolved");
    expect(resolved.connection?.id).toBe(2);

    const duplicate = resolveMainSequenceMarketsApiConnection([
      boundConnection(2),
      boundConnection(3),
    ]);
    expect(duplicate.status).toBe("duplicate");
    expect(duplicate.connections.map((entry) => entry.id)).toEqual([2, 3]);
  });

  it("ignores inactive bound connections", () => {
    const resolved = resolveMainSequenceMarketsApiConnection([
      boundConnection(1, { isActive: false }),
      boundConnection(2),
    ]);

    expect(resolved.status).toBe("resolved");
    expect(resolved.connection?.id).toBe(2);
  });

  it("persists only usable bound connections in session storage", () => {
    writeMainSequenceMarketsApiConnectionSessionCache(boundConnection(1));

    expect(readMainSequenceMarketsApiConnectionSessionCache()?.id).toBe(1);

    clearMainSequenceMarketsApiConnectionSessionCache();
    expect(readMainSequenceMarketsApiConnectionSessionCache()).toBeNull();
  });
});
