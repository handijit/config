import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { copyFixture, fixture, ROOT, run } from "./helpers";

const preset = (name: string): { compilerOptions: Record<string, unknown> } =>
  JSON.parse(readFileSync(join(ROOT, "tsconfig", `${name}.json`), "utf8"));

/** The TypeScript error codes `tsc -p <project>` reports in `dir`. */
const errorCodes = (dir: string, project: string): string[] => {
  const { output } = run("tsc", ["-p", project, "--pretty", "false"], dir);
  return [...output.matchAll(/error (TS\d+)/g)].map(([, code]) => code ?? "");
};

describe("the tsconfig presets", () => {
  it("turn on the house's strictness flags", () => {
    expect(preset("base").compilerOptions).toMatchObject({
      target: "ES2023",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noImplicitOverride: true,
      noUncheckedIndexedAccess: true,
      useUnknownInCatchVariables: true,
      isolatedModules: true,
    });
  });

  it("compile the clean fixtures with tsc", () => {
    expect(
      run("tsc", ["-p", "tsconfig.test.json"], fixture("library"))
    ).toMatchObject({
      status: 0,
    });
    expect(
      run("tsc", ["-p", "tsconfig.node.json"], fixture("app")).status
    ).toBe(0);
    expect(run("tsc", ["-p", "tsconfig.web.json"], fixture("app")).status).toBe(
      0
    );
  });

  it("reject what each strictness flag forbids", () => {
    const copy = copyFixture("library");
    try {
      writeFileSync(
        join(copy.dir, "lib", "strict.ts"),
        [
          "export const first = (list: string[]): string => list[0].trim();", // noUncheckedIndexedAccess
          "export const sign = (n: number): string | undefined => { if (n > 0) { return '+'; } };", // noImplicitReturns
          "export const fall = (n: number): number => { let r = 0; switch (n) { case 1: r = 1; case 2: r = 2; break; } return r; };", // noFallthroughCasesInSwitch
          "export const unused = (n: number): number => { const extra = 1; return 2; };", // noUnusedLocals, noUnusedParameters
          "export const loose = (n) => n;", // strict: implicit any
          "export const caught = (): string => { try { return ''; } catch (error) { return error.message; } };", // useUnknownInCatchVariables
          "class Base { run(): void {} }",
          "export class Child extends Base { run(): void {} }", // noImplicitOverride
        ].join("\n")
      );
      const codes = errorCodes(copy.dir, "tsconfig.json");
      expect(codes).toEqual(
        expect.arrayContaining([
          "TS2532",
          "TS7030",
          "TS7029",
          "TS6133",
          "TS7006",
          "TS18046",
          "TS4114",
        ])
      );
    } finally {
      copy.remove();
    }
  });

  it("give main and preload no DOM, and the renderer no Node", () => {
    const copy = copyFixture("app");
    try {
      writeFileSync(
        join(copy.dir, "src", "main", "title.ts"),
        "export const title = (): string => document.title;\n"
      );
      writeFileSync(
        join(copy.dir, "src", "renderer", "src", "cwd.ts"),
        "export const cwd = (): string => process.cwd();\n"
      );
      expect(errorCodes(copy.dir, "tsconfig.node.json")).toEqual(["TS2584"]);
      expect(errorCodes(copy.dir, "tsconfig.web.json")).toEqual(["TS2591"]);
    } finally {
      copy.remove();
    }
  });
});
