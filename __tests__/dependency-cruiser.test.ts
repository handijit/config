import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { cruise } from "dependency-cruiser";
import type { IConfiguration, ICruiseResult } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app, library } from "../lib/dependency-cruiser";
import type { LibraryOptions } from "../lib/dependency-cruiser";

import { copyFixture, fixture } from "./helpers";

/** The rules broken in `dir`, as `rule: from -> to`, the way the CLI would report them. */
const violations = async (
  dir: string,
  config: IConfiguration,
  target: string
): Promise<string[]> => {
  // Paths in the configuration, and in the results, are relative to the working directory.
  const previous = process.cwd();
  process.chdir(dir);
  try {
    const fileName = config.options?.tsConfig?.fileName ?? "tsconfig.json";
    const { output } = await cruise(
      [target],
      { ...config.options, ruleSet: config, validate: true },
      {},
      { tsConfig: extractTSConfig(fileName) }
    );
    const result = (
      typeof output === "string" ? JSON.parse(output) : output
    ) as ICruiseResult;
    return result.summary.violations.map(
      ({ rule, from, to }) => `${rule.name}: ${from} -> ${to}`
    );
  } finally {
    process.chdir(previous);
  }
};

const write = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const LIBRARY_OPTIONS: LibraryOptions = {
  layers: {
    shared: { environment: "shared", path: "^lib/(index\\.ts$|shared/)" },
    main: { environment: "main" },
    preload: { environment: "preload" },
    renderer: { environment: "renderer" },
  },
  // An entry that imports nothing is still an entry.
  entries: ["^lib/renderer\\.ts$"],
};

describe("the dependency-cruiser library preset", () => {
  const copy = copyFixture("library");
  beforeAll(() => {
    write(
      copy.dir,
      "lib/shared/cycle-a.ts",
      'import { b } from "./cycle-b";\nexport const a = (): string => b();\n'
    );
    write(
      copy.dir,
      "lib/shared/cycle-b.ts",
      'import { a } from "./cycle-a";\nexport const b = (): string => typeof a;\n'
    );
    write(
      copy.dir,
      "lib/shared/platform.ts",
      'import { platform } from "node:os";\nimport { app } from "electron";\nimport { a } from "./cycle-a";\nexport const p = (): string => platform() + app.getVersion() + a();\n'
    );
    write(copy.dir, "lib/shared/lonely.ts", "export const lonely = 1;\n");
    write(
      copy.dir,
      "lib/main/reach.ts",
      'import { isVisible } from "../renderer";\nimport { helper } from "../../__tests__/helper";\nimport { missing } from "./missing";\nimport { p } from "../shared/platform";\nexport const r = (): unknown => [isVisible, helper, missing, p];\n'
    );
    write(copy.dir, "__tests__/helper.ts", "export const helper = 1;\n");
    // One entry building on another by the package's published name is allowed.
    write(
      copy.dir,
      "tsconfig.json",
      JSON.stringify({
        extends: "../../../tsconfig/library.json",
        compilerOptions: {
          types: ["node"],
          paths: { "fixture-library/renderer": ["./lib/renderer.ts"] },
        },
      })
    );
    write(
      copy.dir,
      "lib/main/by-name.ts",
      'import { isVisible } from "fixture-library/renderer";\nimport { r } from "./reach";\nexport const byName = (): unknown => [isVisible, r];\n'
    );
    write(
      copy.dir,
      "lib/renderer/page.ts",
      'import { useState } from "react";\nimport { r } from "../main/reach";\nexport const page = (): unknown => [useState, r];\n'
    );
  });
  afterAll(() => copy.remove());

  it("passes the clean fixture", async () => {
    expect(
      await violations(fixture("library"), library(LIBRARY_OPTIONS), "lib")
    ).toEqual([]);
  });

  it("catches cycles, orphans, the unresolvable, the tests and the layer boundaries", async () => {
    const found = await violations(copy.dir, library(LIBRARY_OPTIONS), "lib");
    expect(found).toEqual(
      expect.arrayContaining([
        "no-circular: lib/shared/cycle-a.ts -> lib/shared/cycle-b.ts",
        "no-orphans: lib/shared/lonely.ts -> lib/shared/lonely.ts",
        "not-to-unresolvable: lib/main/reach.ts -> ./missing",
        "not-to-test: lib/main/reach.ts -> __tests__/helper.ts",
        "main-not-to-renderer: lib/main/reach.ts -> lib/renderer.ts",
        "renderer-not-to-main: lib/renderer/page.ts -> lib/main/reach.ts",
        "shared-not-to-node: lib/shared/platform.ts -> os",
        "shared-not-to-electron: lib/shared/platform.ts -> ../node_modules/electron/index.js",
      ])
    );
    expect(
      found.some((line) =>
        line.startsWith("no-non-package-json: lib/renderer/page.ts")
      )
    ).toBe(true);
    expect(found.filter((line) => line.includes("by-name"))).toEqual([]);
  });

  it("needs no options", () => {
    const { forbidden, options } = library();
    expect(forbidden?.map(({ name }) => name)).toEqual([
      "no-circular",
      "no-orphans",
      "not-to-unresolvable",
      "no-non-package-json",
      "not-to-test",
      "not-to-dev-dep",
    ]);
    expect(options?.tsConfig).toEqual({ fileName: "tsconfig.json" });
  });
});

describe("the dependency-cruiser app preset", () => {
  const copy = copyFixture("app");
  beforeAll(() => {
    write(
      copy.dir,
      "src/renderer/src/services/bad.service.ts",
      "import { ipcRenderer } from 'electron';\nimport { greet } from '@main/services/greeting.service';\nexport const bad = (): unknown => [ipcRenderer, greet];\n"
    );
    write(
      copy.dir,
      "src/preload/extra.ts",
      "import { join } from 'node:path';\nimport { greeting } from '@shared/helpers/greeting.helper';\nimport { useState } from 'react';\nexport const extra = (): unknown => [join, greeting, useState];\n"
    );
    write(
      copy.dir,
      "src/main/page.ts",
      "import { desktop } from '@/services/desktop.service';\nexport const page = (): unknown => desktop;\n"
    );
    write(
      copy.dir,
      "src/shared/helpers/impure.helper.ts",
      "import { greet } from '@main/services/greeting.service';\nimport { app } from 'electron';\nexport const impure = (): unknown => [greet, app];\n"
    );
    write(
      copy.dir,
      "src/main/uses.ts",
      "import { extra } from '../preload/extra';\nimport { bad } from '../renderer/src/services/bad.service';\nimport { impure } from '@shared/helpers/impure.helper';\nexport const uses = (): unknown => [extra, bad, impure];\n"
    );
  });
  afterAll(() => copy.remove());

  it("passes the clean fixture", async () => {
    expect(await violations(fixture("app"), app(), "src")).toEqual([]);
  });

  it("catches every crossing of the layer rule", async () => {
    const found = await violations(copy.dir, app(), "src");
    expect(found).toEqual(
      expect.arrayContaining([
        "renderer-not-to-electron: src/renderer/src/services/bad.service.ts -> ../node_modules/electron/index.js",
        "renderer-not-to-main-or-preload: src/renderer/src/services/bad.service.ts -> src/main/services/greeting.service.ts",
        "preload-not-to-node: src/preload/extra.ts -> path",
        "preload-only-shared-constants-and-types: src/preload/extra.ts -> src/shared/helpers/greeting.helper.ts",
        "preload-not-to-react: src/preload/extra.ts -> ../../../node_modules/react/index.js",
        "main-not-to-renderer-or-preload: src/main/page.ts -> src/renderer/src/services/desktop.service.ts",
        "main-not-to-renderer-or-preload: src/main/uses.ts -> src/preload/extra.ts",
        "shared-not-to-processes: src/shared/helpers/impure.helper.ts -> src/main/services/greeting.service.ts",
        "shared-not-to-electron: src/shared/helpers/impure.helper.ts -> ../node_modules/electron/index.js",
      ])
    );
    expect(
      found.some((line) =>
        line.startsWith("preload-only-electron: src/preload/extra.ts")
      )
    ).toBe(true);
  });
});

describe("the app preset's preload rule", () => {
  const rule = app().forbidden?.find(
    (item) => item.name === "preload-only-electron"
  );
  const allowed = (path: string): boolean =>
    [rule && "to" in rule ? (rule.to.pathNot ?? []) : []]
      .flat()
      .some((pattern) => new RegExp(pattern).test(path));

  it("lets the preload use electron and the house packages' preload entries", () => {
    expect(allowed("node_modules/electron/index.js")).toBe(true);
    expect(allowed("node_modules/@handijit/electron/build/preload.cjs")).toBe(
      true
    );
    expect(
      allowed("../node_modules/@handijit/subscription/build/preload.js")
    ).toBe(true);
    expect(
      allowed("node_modules/@handijit/electron-update/build/preload.mjs")
    ).toBe(true);
    expect(allowed("@handijit/auth/preload")).toBe(true);
  });

  it("keeps every other package out of the preload", () => {
    expect(allowed("node_modules/@handijit/electron/build/main.js")).toBe(
      false
    );
    expect(allowed("node_modules/@handijit/ui/build/preload.js")).toBe(false);
    expect(allowed("node_modules/zod/index.js")).toBe(false);
    expect(allowed("@handijit/subscription")).toBe(false);
  });
});
