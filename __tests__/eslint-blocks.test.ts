import prettierConfig from "eslint-config-prettier/flat";
import { describe, expect, test } from "vitest";

import {
  ignores,
  prettier,
  publicApi,
  react,
  scripts,
  tests,
  typeChecked,
  typescript,
} from "../lib/eslint/blocks";
import { GENERATED, SCRIPT_FILES, TYPESCRIPT_FILES } from "../lib/eslint/globs";
import { layer } from "../lib/eslint/layers";
import {
  patterns,
  restrictGlobals,
  restrictImports,
} from "../lib/eslint/patterns";
import { named } from "./helpers/lint.helper";

const ROOT = "/repo";

describe("globs", () => {
  test("should cover every TypeScript, script and generated file", () => {
    expect(TYPESCRIPT_FILES).toEqual([
      "**/*.ts",
      "**/*.mts",
      "**/*.cts",
      "**/*.tsx",
    ]);
    expect(SCRIPT_FILES).toEqual(["**/*.mjs", "**/*.cjs", "**/*.js"]);
    expect(GENERATED).toEqual([
      "build/**",
      "coverage/**",
      "dist/**",
      "out/**",
      "e2e/out/**",
    ]);
  });
});

describe("ignores", () => {
  test("should ignore the generated output, plus the consumer's own globs", () => {
    expect(ignores()).toEqual([
      { name: "handijit/ignores", ignores: GENERATED },
    ]);
    expect(ignores(["vendor/**"])).toEqual([
      { name: "handijit/ignores", ignores: [...GENERATED, "vendor/**"] },
    ]);
  });
});

describe("typescript", () => {
  test("should extend the recommended rules and add the house rules", () => {
    const configs = typescript({ rootDir: ROOT });
    const own = named(configs, "handijit/typescript");
    expect(own.files).toEqual(TYPESCRIPT_FILES);
    expect(own.rules).toEqual({
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
    });
    expect(own.languageOptions?.parserOptions).toEqual({
      tsconfigRootDir: ROOT,
    });
    // js.configs.recommended and typescript-eslint's recommended set, on the same files.
    const ruleNames = configs.flatMap(({ rules }) => Object.keys(rules ?? {}));
    expect(ruleNames).toContain("no-unused-vars");
    expect(ruleNames).toContain("@typescript-eslint/no-unused-vars");
  });

  test("should take other files", () => {
    const configs = typescript({ rootDir: ROOT, files: ["src/**/*.ts"] });
    expect(named(configs, "handijit/typescript").files).toEqual([
      "src/**/*.ts",
    ]);
  });
});

describe("typeChecked", () => {
  test("should turn on the promise rules with the given program", () => {
    const [config] = typeChecked({
      files: ["lib/**/*.ts"],
      project: "./tsconfig.test.json",
      rootDir: ROOT,
    });
    expect(config?.name).toBe("handijit/type-checked");
    expect(config?.files).toEqual(["lib/**/*.ts"]);
    expect(config?.languageOptions?.parserOptions).toEqual({
      project: "./tsconfig.test.json",
      tsconfigRootDir: ROOT,
    });
    expect(config?.rules).toEqual({
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    });
  });
});

describe("publicApi", () => {
  test("should require explicit types on lib/ by default", () => {
    const [config] = publicApi();
    expect(config?.files).toEqual(["lib/**/*.{ts,tsx}"]);
    expect(config?.rules).toEqual({
      "@typescript-eslint/explicit-module-boundary-types": "error",
    });
  });

  test("should take other files", () => {
    expect(publicApi({ files: ["src/**/*.ts"] })[0]?.files).toEqual([
      "src/**/*.ts",
    ]);
  });
});

describe("react", () => {
  test("should apply the React Hooks recommended rules to .tsx by default", () => {
    const [config] = react();
    expect(config?.name).toBe("handijit/react");
    expect(config?.files).toEqual(["**/*.tsx"]);
    expect(config?.rules?.["react-hooks/rules-of-hooks"]).toBe("error");
    expect(config?.rules?.["react-hooks/exhaustive-deps"]).toBe("warn");
    expect(Object.keys(config?.plugins ?? {})).toEqual(["react-hooks"]);
  });

  test("should take other files", () => {
    expect(react({ files: ["src/**/*.tsx"] })[0]?.files).toEqual([
      "src/**/*.tsx",
    ]);
  });
});

describe("tests", () => {
  test("should reject focused tests under __tests__ by default", () => {
    const [config] = tests();
    expect(config?.files).toEqual(["__tests__/**/*.{ts,tsx}"]);
    expect(config?.rules?.["no-restricted-properties"]).toEqual([
      "error",
      ...["describe", "it", "test"].map((object) => ({
        object,
        property: "only",
        message: "A focused test skips the rest of the suite.",
      })),
    ]);
  });

  test("should take other files", () => {
    expect(tests({ files: ["tests/**/*.ts"] })[0]?.files).toEqual([
      "tests/**/*.ts",
    ]);
  });
});

describe("scripts", () => {
  test("should lint plain JavaScript with Node and browser globals", () => {
    const configs = scripts();
    const own = named(configs, "handijit/scripts");
    expect(own.files).toEqual(SCRIPT_FILES);
    expect(own.languageOptions?.globals).toHaveProperty("process");
    expect(own.languageOptions?.globals).toHaveProperty("window");
    expect(configs.flatMap(({ rules }) => Object.keys(rules ?? {}))).toContain(
      "no-undef"
    );
  });

  test("should take other files", () => {
    expect(
      named(scripts({ files: ["tools/**/*.js"] }), "handijit/scripts").files
    ).toEqual(["tools/**/*.js"]);
  });
});

describe("prettier", () => {
  test("should be eslint-config-prettier's flat config", () => {
    expect(prettier()).toEqual([prettierConfig]);
  });
});

describe("patterns", () => {
  const matches = (pattern: { regex?: string }, specifier: string): boolean =>
    new RegExp(pattern.regex ?? "(?!)").test(specifier);

  test("should match Node by its node: and bare names only", () => {
    for (const specifier of ["node:fs", "fs", "fs/promises", "path"]) {
      expect(matches(patterns.node, specifier)).toBe(true);
    }
    for (const specifier of ["fsx", "@handijitcom/fs", "./fs", "pathe"]) {
      expect(matches(patterns.node, specifier)).toBe(false);
    }
  });

  test("should match electron, react and zod without catching look-alikes", () => {
    expect(matches(patterns.electron, "electron")).toBe(true);
    expect(matches(patterns.electron, "electron/main")).toBe(true);
    expect(matches(patterns.electron, "@handijitcom/electron")).toBe(false);
    expect(matches(patterns.electron, "electron-updater")).toBe(false);
    expect(matches(patterns.react, "react")).toBe(true);
    expect(matches(patterns.react, "react-dom/client")).toBe(true);
    expect(matches(patterns.react, "./react")).toBe(false);
    expect(matches(patterns.react, "react-bootstrap-icons")).toBe(false);
    expect(matches(patterns.zod, "zod/mini")).toBe(true);
    expect(patterns.zodTypes.allowTypeImports).toBe(true);
  });

  test("should write a rule only for a non-empty list", () => {
    expect(restrictImports([])).toEqual({});
    expect(restrictGlobals([])).toEqual({});
    expect(restrictImports([patterns.react])).toEqual({
      "no-restricted-imports": ["error", { patterns: [patterns.react] }],
    });
    expect(restrictGlobals([{ name: "window", message: "No DOM." }])).toEqual({
      "no-restricted-globals": [
        "error",
        { name: "window", message: "No DOM." },
      ],
    });
  });
});

describe("layer", () => {
  test("should restrict imports and globals by environment", () => {
    const config = layer({
      name: "handijit/layer/renderer",
      files: ["lib/renderer/**"],
      environment: "renderer",
      zod: "forbid",
    });
    expect(config).toEqual({
      name: "handijit/layer/renderer",
      files: ["lib/renderer/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          { patterns: [patterns.node, patterns.electron, patterns.zod] },
        ],
        "no-restricted-globals": [
          "error",
          ...[
            "Buffer",
            "process",
            "require",
            "__dirname",
            "__filename",
            "global",
          ].map((name) => ({
            name,
            message: "The renderer is a web page; it must run without Node.",
          })),
        ],
      },
    });
  });

  test("should write no import rule for main with Zod allowed", () => {
    const { rules } = layer({
      name: "main",
      files: ["lib/main/**"],
      environment: "main",
      zod: "allow",
    });
    expect(rules?.["no-restricted-imports"]).toEqual([
      "error",
      { patterns: [patterns.react] },
    ]);
  });
});
