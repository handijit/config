import { describe, expect, it, vi } from "vitest";

// The house setup file restores real timers after each test, even after a failing one.
describe("timers", () => {
  it("may switch to fake timers", () => {
    vi.useFakeTimers();
    expect(vi.isFakeTimers()).toBe(true);
  });

  it("gets real timers back in the next test", () => {
    expect(vi.isFakeTimers()).toBe(false);
  });
});
