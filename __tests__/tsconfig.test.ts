import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, test } from "vitest";

import { fixture } from "./helpers/lint.helper";

const PRESETS = fileURLToPath(new URL("../tsconfig/", import.meta.url));
const TSC = fileURLToPath(new URL("../node_modules/.bin/tsc", import.meta.url));

type Preset = {
  $schema?: string;
  display?: string;
  extends?: string;
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
};

const read = (name: string): Preset =>
  JSON.parse(readFileSync(join(PRESETS, name), "utf8")) as Preset;

/** Parses a tsconfig with the TypeScript 6 API, the way ESLint and Rollup read it. */
const parse = (file: string): ts.ParsedCommandLine => {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    file,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
        );
      },
    }
  );
  if (parsed === undefined) throw new Error(`Cannot parse ${file}`);
  return parsed;
};

/** Type-checks a project with the TypeScript 7 `tsc`, the way `npm run typecheck` does. */
const typecheck = (
  project: string
): { status: number | null; output: string } => {
  const { status, stdout, stderr } = spawnSync(
    TSC,
    ["--noEmit", "-p", project],
    { encoding: "utf8" }
  );
  return { status, output: `${stdout}${stderr}` };
};

const libs = (options: ts.CompilerOptions): string[] =>
  (options.lib ?? []).toSorted();

describe("tsconfig presets", () => {
  test("should ship exactly the four documented presets", () => {
    expect(readdirSync(PRESETS).toSorted()).toEqual([
      "base.json",
      "electron-node.json",
      "electron-web.json",
      "library.json",
    ]);
  });

  test("should be plain JSON with a schema, extending the base", () => {
    for (const name of readdirSync(PRESETS)) {
      const preset = read(name);
      expect(preset.$schema).toBe("https://json.schemastore.org/tsconfig");
      expect(preset.display).toMatch(/^Han Dijit /);
      expect(preset.extends).toBe(
        name === "base.json" ? undefined : "./base.json"
      );
    }
  });

  test("should avoid every option TypeScript 7 removed", () => {
    for (const name of readdirSync(PRESETS)) {
      const options = read(name).compilerOptions ?? {};
      expect(options).not.toHaveProperty("baseUrl");
      expect(options).not.toHaveProperty("downlevelIteration");
      expect(options.esModuleInterop).not.toBe(false);
      expect(["node", "node10", "classic"]).not.toContain(
        String(options.moduleResolution).toLowerCase()
      );
      expect(["amd", "umd", "system"]).not.toContain(
        String(options.module).toLowerCase()
      );
      expect(String(options.target).toLowerCase()).not.toBe("es5");
    }
  });

  test("should hold the strict flag set of NPM_PACKAGE.md section 8 in the base", () => {
    expect(read("base.json").compilerOptions).toEqual({
      target: "ES2023",
      module: "ESNext",
      lib: ["ES2023"],
      moduleResolution: "bundler",
      jsx: "react-jsx",
      types: [],
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noImplicitOverride: true,
      noUncheckedIndexedAccess: true,
      useUnknownInCatchVariables: true,
      isolatedModules: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
    });
  });
});

describe("library.json", () => {
  const dir = fixture("tsconfig-library");

  test("should resolve against the consumer's directory, with the DOM and no ambient types", () => {
    const { options, fileNames, errors } = parse(join(dir, "tsconfig.json"));
    expect(errors).toEqual([]);
    expect(options.target).toBe(ts.ScriptTarget.ES2023);
    expect(options.module).toBe(ts.ModuleKind.ESNext);
    expect(options.moduleResolution).toBe(ts.ModuleResolutionKind.Bundler);
    expect(libs(options)).toEqual(["lib.dom.d.ts", "lib.es2023.d.ts"]);
    expect(options.types).toEqual([]);
    expect(options.strict).toBe(true);
    expect(options.noUncheckedIndexedAccess).toBe(true);
    expect(options.noEmit).toBeUndefined();
    expect(fileNames).toEqual([join(dir, "lib/href.ts")]);
  });

  test("should type-check with TypeScript 7", () => {
    expect(typecheck(join(dir, "tsconfig.json"))).toEqual({
      status: 0,
      output: "",
    });
  });
});

describe("electron-node.json and electron-web.json", () => {
  const dir = fixture("tsconfig-electron");

  test("should give main, preload and shared the Node types and no DOM", () => {
    const { options, fileNames, errors } = parse(
      join(dir, "tsconfig.node.json")
    );
    expect(errors).toEqual([]);
    expect(libs(options)).toEqual(["lib.es2023.d.ts"]);
    expect(options.types).toEqual(["node"]);
    expect(options.noEmit).toBe(true);
    expect(options.paths).toEqual({
      "@main/*": [join(dir, "src/main/*")],
      "@shared/*": [join(dir, "src/shared/*")],
    });
    expect(fileNames.toSorted()).toEqual([
      join(dir, "src/main/index.ts"),
      join(dir, "src/preload/index.ts"),
      join(dir, "src/shared/constants.ts"),
    ]);
  });

  test("should give the renderer and shared the DOM and no Node types", () => {
    const { options, fileNames, errors } = parse(
      join(dir, "tsconfig.web.json")
    );
    expect(errors).toEqual([]);
    expect(libs(options)).toEqual([
      "lib.dom.d.ts",
      "lib.dom.iterable.d.ts",
      "lib.es2023.d.ts",
    ]);
    expect(options.types).toEqual([]);
    expect(options.noEmit).toBe(true);
    expect(options.paths).toEqual({
      "@/*": [join(dir, "src/renderer/src/*")],
      "@shared/*": [join(dir, "src/shared/*")],
    });
    expect(fileNames.toSorted()).toEqual([
      join(dir, "src/renderer/src/app.ts"),
      join(dir, "src/shared/constants.ts"),
    ]);
  });

  test("should type-check both with TypeScript 7, aliases included", () => {
    for (const project of ["tsconfig.node.json", "tsconfig.web.json"]) {
      expect(typecheck(join(dir, project))).toEqual({ status: 0, output: "" });
    }
  });
});
