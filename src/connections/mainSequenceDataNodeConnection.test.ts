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
    expect(buildMainSequenceDataNodeDetailQueryKey(714)).toEqual([
      "main_sequence",
      "connections",
      "mainsequence.data-node",
      "unselected",
      "data-node-detail",
      714,
    ]);
    expect(buildMainSequenceDataNodeLastObservationQueryKey(714)).toEqual([
      "main_sequence",
      "connections",
      "mainsequence.data-node",
      "unselected",
      "data-node-last-observation",
      714,
    ]);
  });

  it("fails fast when no backend connection ref is selected", async () => {
    await expect(queryMainSequenceDataNodeDetail(714)).rejects.toThrow(
      "Select a Data Node connection before running this request.",
    );
    await expect(
      queryMainSequenceDataNodeRowsBetweenDates(
        714,
        {
          start_date: 1_700_000_000,
          end_date: 1_700_086_400,
          columns: ["asof", "value"],
        },
      ),
    ).rejects.toThrow("Select a Data Node connection before running this request.");
    await expect(queryMainSequenceDataNodeLastObservation(714)).rejects.toThrow(
      "Select a Data Node connection before running this request.",
    );
  });
});
