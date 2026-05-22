import { describe, expect, it } from "vitest";

import {
  buildMainSequenceDataNodeDetailQueryKey,
  buildMainSequenceDataNodeLastObservationQueryKey,
  queryMainSequenceDataNodeDetail,
  queryMainSequenceDataNodeLastObservation,
  queryMainSequenceDataNodeRowsBetweenDates,
} from "../../extensions/main_sequence/extensions/workbench/connections/dataNodeConnection";

describe("mainSequenceDataNodeConnection", () => {
  it("does not fabricate a placeholder connection id in query keys", () => {
    expect(buildMainSequenceDataNodeDetailQueryKey("00000000-0000-0000-0000-000000000714")).toEqual([
      "main_sequence",
      "connections",
      "mainsequence.data-node",
      "unselected",
      "data-node-detail",
      "00000000-0000-0000-0000-000000000714",
    ]);
    expect(
      buildMainSequenceDataNodeLastObservationQueryKey("00000000-0000-0000-0000-000000000714"),
    ).toEqual([
      "main_sequence",
      "connections",
      "mainsequence.data-node",
      "unselected",
      "data-node-last-observation",
      "00000000-0000-0000-0000-000000000714",
    ]);
  });

  it("fails fast when no backend connection ref is selected", async () => {
    await expect(queryMainSequenceDataNodeDetail("00000000-0000-0000-0000-000000000714")).rejects.toThrow(
      "Select a Data Node connection before running this request.",
    );
    await expect(
      queryMainSequenceDataNodeRowsBetweenDates(
        "00000000-0000-0000-0000-000000000714",
        {
          start_date: 1_700_000_000,
          end_date: 1_700_086_400,
          columns: ["asof", "value"],
        },
      ),
    ).rejects.toThrow("Select a Data Node connection before running this request.");
    await expect(
      queryMainSequenceDataNodeLastObservation("00000000-0000-0000-0000-000000000714"),
    ).rejects.toThrow(
      "Select a Data Node connection before running this request.",
    );
  });
});
