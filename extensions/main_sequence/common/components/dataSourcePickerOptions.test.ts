import { describe, expect, it } from "vitest";

import { resolvePhysicalDataSourceIcon } from "./physicalDataSourceIcons";
import {
  toPhysicalDataSourcePickerOption,
  toProjectDataSourcePickerOption,
} from "./dataSourcePickerOptions";

describe("data source picker options", () => {
  it("builds project data source options with physical source icons", () => {
    const option = toProjectDataSourcePickerOption({
      id: 301,
      uid: "project-data-source-301",
      related_resource: {
        id: "physical-data-source-701",
        uid: "physical-data-source-701",
        display_name: "Default DB",
        name: "Default DB",
        organization: 1,
        class_type: "timescale_db_remote",
        status: "AVAILABLE",
        source_logo: "database",
      },
      related_resource_class_type: "timescale_db_remote",
    });

    expect(option).toMatchObject({
      value: "project-data-source-301",
      label: "Default DB",
      description: "timescale_db_remote · AVAILABLE",
      image: resolvePhysicalDataSourceIcon({ classType: "timescale_db_remote" }),
      imageAlt: "Default DB data source",
      fallbackIcon: "database",
    });
    expect(option.keywords).toContain("physical-data-source-701");
  });

  it("builds physical data source options with a database fallback icon", () => {
    const option = toPhysicalDataSourcePickerOption({
      id: "physical-source-1",
      uid: null,
      label: "Unknown warehouse",
      class_type: "custom_warehouse",
      status: "healthy",
      source_logo: "database",
    });

    expect(option).toMatchObject({
      value: "physical-source-1",
      label: "Unknown warehouse",
      description: "custom_warehouse · healthy",
      image: null,
      fallbackIcon: "database",
    });
  });
});
