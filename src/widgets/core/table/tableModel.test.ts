import { describe, expect, it } from "vitest";

import {
  formatTableWidgetValue,
  parseTableWidgetDateTimeValue,
  validateTableWidgetSchema,
} from "./tableModel";

describe("table widget datetime formatting", () => {
  it("parses epoch timestamps across second and millisecond units", () => {
    expect(parseTableWidgetDateTimeValue(1777112662203)).toBe(1777112662203);
    expect(parseTableWidgetDateTimeValue("1777112662")).toBe(1777112662000);
  });

  it("uses an explicit input pattern before rendering an output pattern", () => {
    expect(
      formatTableWidgetValue("26/04/2026 10:21:02.203", {
        compact: false,
        dateTimeInputFormat: "dd/MM/yyyy HH:mm:ss.SSS",
        dateTimeOutputFormat: "yyyy-MM-dd HH:mm:ss.SSS",
        format: "datetime",
      }),
    ).toBe("2026-04-26 10:21:02.203");
  });

  it("does not treat datetime columns as numeric validation failures", () => {
    const validation = validateTableWidgetSchema(
      [{ openTime: "2026-04-26T10:21:02.203Z" }],
      [{ key: "openTime", format: "datetime" }],
    );

    expect(validation.issues).toEqual([]);
  });
});
