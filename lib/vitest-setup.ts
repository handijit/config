import { afterEach, vi } from "vitest";

/**
 * `@handijit/config/vitest/setup`: the house setup file, which the Vitest presets load. A test
 * that switches to fake timers and fails before switching back would otherwise leave every
 * later test in the file on a frozen clock.
 */
afterEach(() => {
  vi.useRealTimers();
});
