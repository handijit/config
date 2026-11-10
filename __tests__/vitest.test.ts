import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { app, library } from "../lib/vitest";

import { fixture, run } from "./helpers";

describe("the Vitest library preset", () => {
  it("measures every line of the source but barrels and types", () => {
    const { test } = library();
    expect(test?.coverage).toEqual({
      provider: "v8",
      include: ["lib/**/*.{ts,tsx}"],
      exclude: ["lib/index.ts", "lib/types/**"],
      thresholds: { 100: true },
    });
    expect(test).toMatchObject({
      clearMocks: true,
      restoreMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
    });
  });

  it("loads the house setup file, then the consumer's", () => {
    const setupFiles = library({ setupFiles: ["./setup.ts"] }).test?.setupFiles;
    expect(setupFiles).toHaveLength(2);
    expect(existsSync(String(setupFiles?.[0]))).toBe(true);
    expect(setupFiles?.[1]).toBe("./setup.ts");
  });

  it("passes the fixture: node and jsdom projects, timers reset, full coverage", () => {
    const { status, output } = run(
      "vitest",
      ["run", "--coverage", "--reporter=verbose"],
      fixture("library")
    );
    expect(output).toMatch(/\|node\| __tests__\/timers\.test\.ts/);
    expect(output).toMatch(/\|jsdom\| __tests__\/renderer\.dom\.test\.ts/);
    expect(status).toBe(0);
  });

  it("fails when a line is left uncovered", () => {
    const { status, output } = run(
      "vitest",
      ["run", "--coverage", "__tests__/format.test.ts"],
      fixture("library")
    );
    expect(output).toMatch(
      /Coverage for lines \(.+%\) does not meet global threshold \(100%\)/
    );
    expect(status).not.toBe(0);
  });
});

describe("the Vitest app preset", () => {
  it("resolves the aliases and measures the pure-logic layers", () => {
    const config = app({
      rootDir: "/app",
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    });
    expect(config.resolve?.alias).toEqual({
      "@main": "/app/src/main",
      "@shared": "/app/src/shared",
      "@": "/app/src/renderer/src",
    });
    expect(config.test?.coverage).toMatchObject({
      include: expect.arrayContaining([
        "src/shared/**/*.ts",
        "src/main/services/**/*.ts",
      ]),
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    });
  });

  it("passes the fixture at its measured thresholds and fails above them", () => {
    expect(run("vitest", ["run", "--coverage"], fixture("app")).status).toBe(0);
    const above = run(
      "vitest",
      ["run", "--coverage", "--coverage.thresholds.lines=90"],
      fixture("app")
    );
    expect(above.output).toMatch(/does not meet global threshold \(90%\)/);
    expect(above.status).not.toBe(0);
  });
});
