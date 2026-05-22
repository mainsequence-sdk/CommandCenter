import { describe, expect, it } from "vitest";

import type { DataNodeDetail, EntitySummaryHeader } from "../../../../common/api";
import { resolvePhysicalDataSourceIcon } from "../../../../common/components/physicalDataSourceIcons";

import {
  buildDataNodeEngineFieldDecoration,
  decorateDataNodeSummaryWithEngineIcon,
  isTimescaleDataNodeEngineClassType,
  resolveDataNodeEngineClassType,
} from "./dataNodeSummary";

describe("data node summary engine decoration", () => {
  it("reads the canonical source class type from related_resource_class_type", () => {
    expect(
      resolveDataNodeEngineClassType({
        data_source: {
          id: 1,
          uid: "data-source-1",
          related_resource: {
            id: "physical-source-2",
            uid: "physical-source-2",
            organization: 1,
            class_type: "postgresql",
            status: "AVAILABLE",
          },
          related_resource_class_type: "timescale_db_remote",
        },
      }),
    ).toBe("timescale_db_remote");
  });

  it("falls back to the related resource class type when the canonical shortcut is blank", () => {
    expect(
      resolveDataNodeEngineClassType({
        data_source: {
          id: 1,
          uid: "data-source-1",
          related_resource: {
            id: "physical-source-2",
            uid: "physical-source-2",
            organization: 1,
            class_type: "postgresql",
            status: "AVAILABLE",
          },
          related_resource_class_type: "",
        },
      }),
    ).toBe("postgresql");
  });

  it("identifies Timescale-backed engine class types", () => {
    expect(isTimescaleDataNodeEngineClassType("timescale_db")).toBe(true);
    expect(isTimescaleDataNodeEngineClassType("timescale_db_remote")).toBe(true);
    expect(isTimescaleDataNodeEngineClassType("duck_db")).toBe(false);
  });

  it("adds the resolved engine icon to the summary engine field while preserving the text value", () => {
    const summary: EntitySummaryHeader = {
      entity: {
        id: 26,
        type: "data_node",
        title: "Data node 26",
      },
      badges: [],
      inline_fields: [
        {
          key: "engine",
          label: "Engine",
          value: "Timescale DB",
          kind: "text",
        },
      ],
      highlight_fields: [],
      stats: [],
    };
    const dataNodeDetail = {
      data_source: {
        id: 1,
        uid: "data-source-1",
        related_resource: {
          id: "physical-source-2",
          uid: "physical-source-2",
          organization: 1,
          class_type: "timescale_db_remote",
          status: "AVAILABLE",
        },
        related_resource_class_type: "timescale_db_remote",
      },
    } satisfies Pick<DataNodeDetail, "data_source">;

    const decorated = decorateDataNodeSummaryWithEngineIcon(summary, dataNodeDetail);

    expect(decorated.inline_fields[0]?.value).toBe("Timescale DB");
    expect(decorated.inline_fields[0]?.image).toBe(
      resolvePhysicalDataSourceIcon({ classType: "timescale_db_remote" }),
    );
    expect(decorated.inline_fields[0]?.image_alt).toBe("Timescale DB engine");
  });

  it("decorates highlight-field engine values too", () => {
    const summary: EntitySummaryHeader = {
      entity: {
        id: 26,
        type: "data_node",
        title: "Data node 26",
      },
      badges: [],
      inline_fields: [],
      highlight_fields: [
        {
          key: "engine",
          label: "Engine",
          value: "Duck DB",
          kind: "text",
        },
      ],
      stats: [],
    };

    const decorated = decorateDataNodeSummaryWithEngineIcon(summary, {
      data_source: {
        id: 1,
        uid: "data-source-1",
        related_resource: {
          id: "physical-source-2",
          uid: "physical-source-2",
          organization: 1,
          class_type: "duck_db",
          status: "AVAILABLE",
        },
        related_resource_class_type: "duck_db",
      },
    });

    expect(decorated.highlight_fields[0]?.image).toBe(
      resolvePhysicalDataSourceIcon({ classType: "duck_db" }),
    );
    expect(decorated.highlight_fields[0]?.image_alt).toBe("Duck DB engine");
  });

  it("builds fallback field decoration for list-backed data source labels", () => {
    expect(
      buildDataNodeEngineFieldDecoration(
        {
          data_source: {
            id: 1,
            uid: "data-source-1",
            related_resource: {
              id: "physical-source-2",
              uid: "physical-source-2",
              organization: 1,
              class_type: "duck_db",
              status: "AVAILABLE",
            },
            related_resource_class_type: "duck_db",
          },
        },
        "Duck DB",
      ),
    ).toEqual({
      image: resolvePhysicalDataSourceIcon({ classType: "duck_db" }),
      image_alt: "Duck DB engine",
    });
  });
});
