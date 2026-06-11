import { describe, expect, it } from "vitest";

import { formatMainSequenceError, MainSequenceApiError } from "./index";

describe("formatMainSequenceError", () => {
  it("prefers the explicit error message over diagnostic details", () => {
    const error = new MainSequenceApiError(
      "The Main Sequence Markets data source contract does not expose GET /api/v1/account/.",
      400,
      {
        connectionId: "7aeda6b7-b45d-47fa-93de-10237c6a9fca",
      },
    );

    expect(formatMainSequenceError(error)).toBe(
      "The Main Sequence Markets data source contract does not expose GET /api/v1/account/.",
    );
  });
});
