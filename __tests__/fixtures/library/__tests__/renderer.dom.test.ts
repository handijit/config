import { describe, expect, it } from "vitest";

import { isVisible } from "../lib/renderer";

describe("isVisible", () => {
  it("runs in a DOM", () => {
    expect(typeof isVisible()).toBe("boolean");
  });
});
