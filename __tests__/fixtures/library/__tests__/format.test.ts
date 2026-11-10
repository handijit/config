import { describe, expect, it } from "vitest";

import { formatVersion } from "../lib/shared/format";

describe("formatVersion", () => {
  it("joins the parts with a dot", () => {
    expect(formatVersion(1, 2)).toBe("1.2");
  });
});
