import { describe, expect, it } from "vitest";

import {
  buildManagedConnectionConsumerDraftSignature,
  type AnyManagedConnectionConsumerAdapter,
} from "./managed-connection-consumer";

const testAdapter = {
  widgetId: "table",
  sourceInputId: "seedData",
  sourceOutputId: "dataset",
  connectionMode: "connection",
  getSourceMode(props: Record<string, unknown>) {
    return typeof props.tableSourceMode === "string" ? props.tableSourceMode : "bound";
  },
  setSourceMode(props: Record<string, unknown>, mode: string) {
    return {
      ...props,
      tableSourceMode: mode,
    };
  },
  getEmbeddedConnectionQuery(props: Record<string, unknown>) {
    return (props.embeddedConnectionQuery ?? {}) as Record<string, unknown>;
  },
  setEmbeddedConnectionQuery(props: Record<string, unknown>, value: Record<string, unknown>) {
    return {
      ...props,
      embeddedConnectionQuery: value,
    };
  },
  getEmbeddedConnectionPresentation() {
    return undefined;
  },
  setEmbeddedConnectionPresentation(props: Record<string, unknown>) {
    return props;
  },
  buildManagedSourceTitle() {
    return "Source";
  },
} satisfies AnyManagedConnectionConsumerAdapter;

describe("buildManagedConnectionConsumerDraftSignature", () => {
  it("treats mock API response body changes as managed connection draft changes", () => {
    const baseProps = {
      tableSourceMode: "connection",
      embeddedConnectionQuery: {
        connectionRef: {
          id: "mock-api-demo",
          typeId: "mock-api",
        },
        queryModelId: "mock-api-response",
        query: {
          kind: "mock-api-response",
          responseMode: "rows",
          responseStatus: 200,
          responseBody: [{ Symbol: "BTCUSDT" }],
        },
      },
    };
    const updatedProps = {
      ...baseProps,
      embeddedConnectionQuery: {
        ...baseProps.embeddedConnectionQuery,
        query: {
          ...baseProps.embeddedConnectionQuery.query,
          responseBody: [{ Symbol: "ETHUSDT" }],
        },
      },
    };

    expect(
      buildManagedConnectionConsumerDraftSignature(
        testAdapter,
        updatedProps,
      ),
    ).not.toBe(
      buildManagedConnectionConsumerDraftSignature(
        testAdapter,
        baseProps,
      ),
    );
  });
});
