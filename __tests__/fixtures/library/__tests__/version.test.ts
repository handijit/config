import { describe, expect, it } from "vitest";

import { readVersion } from "../lib/main/version";

describe("readVersion", () => {
  it("reads two numbers", async () => {
    await expect(readVersion()).resolves.toMatch(/^\d+\.\d+$/);
  });
});
