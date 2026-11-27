import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { app, library } from "../lib/vitest";

const SETUP = fileURLToPath(new URL("../lib/vitest-setup.ts", import.meta.url));
const COVERAGE_GUARD = fileURLToPath(
  new URL("../lib/vitest-coverage.ts", import.meta.url)
);

const projects = (tests: string): unknown[] => [
  {
    extends: true,
    test: {
      name: "node",
      environment: "node",
      include: [`${tests}/**/*.test.ts`],
      exclude: [`${tests}/**/*.dom.test.ts`],
    },
  },
  {
    extends: true,
    test: {
      name: "jsdom",
      environment: "jsdom",
      include: [`${tests}/**/*.dom.test.{ts,tsx}`],
    },
  },
];

const RESET = {
  clearMocks: true,
  restoreMocks: true,
  unstubGlobals: true,
  unstubEnvs: true,
};

describe("vitest library preset", () => {
  test("should run node and jsdom projects with 100 % coverage by default", () => {
    expect(library()).toEqual({
      test: {
        projects: projects("__tests__"),
        ...RESET,
        setupFiles: [SETUP],
        globalSetup: [COVERAGE_GUARD],
        coverage: {
          provider: "v8",
          include: ["lib/**/*.{ts,tsx}"],
          exclude: ["lib/index.ts", "lib/types/**"],
          thresholds: { 100: true },
        },
      },
    });
    expect(existsSync(SETUP)).toBe(true);
    expect(existsSync(COVERAGE_GUARD)).toBe(true);
  });

  test("should honour every option", () => {
    expect(
      library({
        source: "src",
        tests: "test",
        barrels: ["src/main.ts"],
        setupFiles: ["./vitest.setup.ts"],
      })
    ).toEqual({
      test: {
        projects: projects("test"),
        ...RESET,
        setupFiles: [SETUP, "./vitest.setup.ts"],
        globalSetup: [COVERAGE_GUARD],
        coverage: {
          provider: "v8",
          include: ["src/**/*.{ts,tsx}"],
          exclude: ["src/main.ts"],
          thresholds: { 100: true },
        },
      },
    });
  });

  test("should derive the default barrels from the source directory", () => {
    expect(library({ source: "src" }).test?.coverage).toMatchObject({
      exclude: ["src/index.ts", "src/types/**"],
    });
  });
});

describe("vitest app preset", () => {
  const thresholds = { lines: 80, functions: 80, branches: 70, statements: 80 };

  test("should resolve the aliases and gate the pure-logic layers", () => {
    expect(app({ rootDir: "/app", thresholds })).toEqual({
      resolve: {
        alias: {
          "@main": resolve("/app", "src/main"),
          "@shared": resolve("/app", "src/shared"),
          "@": resolve("/app", "src/renderer/src"),
        },
      },
      test: {
        projects: projects("tests/unit"),
        ...RESET,
        setupFiles: [SETUP],
        globalSetup: [COVERAGE_GUARD],
        coverage: {
          provider: "v8",
          include: [
            "src/shared/**/*.ts",
            "src/main/services/**/*.ts",
            "src/renderer/src/hooks/**/*.{ts,tsx}",
            "src/renderer/src/helpers/**/*.ts",
            "src/renderer/src/store/**/*.ts",
          ],
          thresholds,
        },
      },
    });
  });

  test("should honour every option", () => {
    const config = app({
      rootDir: "/app",
      thresholds,
      tests: "spec",
      coverage: ["src/shared/**/*.ts"],
      setupFiles: ["./setup.ts"],
    });
    expect(config.test).toMatchObject({
      projects: projects("spec"),
      setupFiles: [SETUP, "./setup.ts"],
      globalSetup: [COVERAGE_GUARD],
      coverage: { include: ["src/shared/**/*.ts"], thresholds },
    });
  });
});
