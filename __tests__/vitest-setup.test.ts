import { describe, expect, test, vi } from "vitest";

// The two tests run in order on purpose: the second one is the sentinel of the house setup file
// (loaded by this repository's own Vitest preset) undoing what the first one left behind.
describe("house setup file", () => {
  test("a test may switch to fake timers and fail to switch back", () => {
    vi.useFakeTimers();
    expect(vi.isFakeTimers()).toBe(true);
  });

  test("should restore real timers before the next test", () => {
    expect(vi.isFakeTimers()).toBe(false);
  });
});
