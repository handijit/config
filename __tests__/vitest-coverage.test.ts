import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";
import type { TestProject } from "vitest/node";

import guardCoverage from "../lib/vitest-coverage";

// A small library: `lib/href.ts` and nothing else.
const ROOT = fileURLToPath(
  new URL("./fixtures/tsconfig-library", import.meta.url)
);

const NOTHING = /^Coverage would measure no file: coverage\.include/;

type Coverage = { enabled: boolean; include?: string[]; exclude: string[] };

// Only the resolved root and coverage options are read; the rest of Vitest is not needed.
const project = (coverage: Coverage): Pick<TestProject, "vitest"> =>
  ({ vitest: { config: { root: ROOT, coverage } } }) as unknown as Pick<
    TestProject,
    "vitest"
  >;

describe("vitest coverage guard", () => {
  test("should let a run through when the include matches a source file", () => {
    expect(() =>
      guardCoverage(
        project({ enabled: true, include: ["lib/**/*.ts"], exclude: [] })
      )
    ).not.toThrow();
  });

  test("should fail a run whose include matches no file", () => {
    expect(() =>
      guardCoverage(
        project({ enabled: true, include: ["src/**/*.ts"], exclude: [] })
      )
    ).toThrow(NOTHING);
  });

  test("should fail a run whose exclude swallows every included file", () => {
    expect(() =>
      guardCoverage(
        project({
          enabled: true,
          include: ["lib/**/*.ts"],
          exclude: ["lib/**"],
        })
      )
    ).toThrow(NOTHING);
  });

  test("should not count a directory the include happens to match", () => {
    expect(() =>
      guardCoverage(project({ enabled: true, include: ["lib"], exclude: [] }))
    ).toThrow(NOTHING);
  });

  test("should name the include and the root in the error", () => {
    expect(() =>
      guardCoverage(
        project({ enabled: true, include: ["src/**/*.ts"], exclude: [] })
      )
    ).toThrow(`coverage.include ["src/**/*.ts"]`);
    expect(() =>
      guardCoverage(
        project({ enabled: true, include: ["src/**/*.ts"], exclude: [] })
      )
    ).toThrow(`matches nothing under ${ROOT}`);
  });

  test("should stay out of a run without coverage", () => {
    expect(() =>
      guardCoverage(
        project({ enabled: false, include: ["src/**/*.ts"], exclude: [] })
      )
    ).not.toThrow();
  });

  test("should stay out when there is no include to check", () => {
    expect(() =>
      guardCoverage(project({ enabled: true, exclude: [] }))
    ).not.toThrow();
  });
});
