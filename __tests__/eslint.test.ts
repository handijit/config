import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ESLint } from "eslint";
import type { Linter } from "eslint";
import { describe, expect, it, vi } from "vitest";

import {
  app,
  layer,
  library,
  patterns,
  restrictGlobals,
  restrictImports,
} from "../lib/eslint";
import type { LibraryLayer } from "../lib/eslint";

import { copyFixture, fixture } from "./helpers";

const LIBRARY = fixture("library");
const APP = fixture("app");

// The fixture library ships an entry per process, like @handijit/electron-update.
const LAYERS: Record<string, LibraryLayer> = {
  shared: {
    environment: "shared",
    files: ["lib/index.ts", "lib/shared/**/*.ts"],
  },
  main: { environment: "main" },
  preload: { environment: "preload" },
  renderer: { environment: "renderer" },
};

// Most tests lint text that is not what the file on disk holds. typescript-eslint's single-run
// mode, which it switches on by itself when CI=true or under the eslint CLI, builds each
// TypeScript program once from disk and never updates it, so the types would describe the old
// file. The tests therefore opt out of that inference; "lints files on disk in single-run
// mode" below covers the mode itself, the way the CLI uses it.
const WATCHED_PROGRAMS: Linter.Config = {
  name: "test/watched-programs",
  languageOptions: {
    parserOptions: { disallowAutomaticSingleRunInference: true },
  },
};

const eslintFor = (cwd: string, config: Linter.Config[]): ESLint =>
  new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [...config, WATCHED_PROGRAMS],
  });

const libraryConfig = (
  options: Partial<Parameters<typeof library>[0]> = {}
): Linter.Config[] => library({ rootDir: LIBRARY, layers: LAYERS, ...options });

/** The rules `text`, linted as if it were the file at `path`, breaks. */
const rulesBroken = async (
  eslint: ESLint,
  path: string,
  text: string
): Promise<(string | null)[]> => {
  const [result] = await eslint.lintText(text, { filePath: path });
  return (result?.messages ?? []).map(({ ruleId }) => ruleId);
};

describe("the library preset", () => {
  const eslint = eslintFor(LIBRARY, libraryConfig());
  const broken = (path: string, text: string): Promise<(string | null)[]> =>
    rulesBroken(eslint, path, text);

  it("passes the clean fixture", async () => {
    const results = await eslint.lintFiles(["."]);
    expect(results.flatMap(({ messages }) => messages)).toEqual([]);
    expect(results.map(({ filePath }) => filePath).length).toBeGreaterThan(8);
  });

  it("rejects any, console and type imports written as values", async () => {
    expect(
      await broken(
        "lib/shared/format.ts",
        "export const echo = (value: any): any => value;\n"
      )
    ).toContain("@typescript-eslint/no-explicit-any");
    expect(
      await broken("lib/shared/format.ts", 'console.log("x");\n')
    ).toContain("no-console");
    expect(
      await broken(
        "lib/main/version.ts",
        'import { formatVersion } from "../shared/format";\nexport type F = typeof formatVersion;\n'
      )
    ).toContain("@typescript-eslint/consistent-type-imports");
  });

  it("asks the public surface for explicit return types", async () => {
    expect(
      await broken("lib/shared/format.ts", "export const one = () => 1;\n")
    ).toContain("@typescript-eslint/explicit-module-boundary-types");
  });

  it("catches promise mistakes with type information", async () => {
    expect(
      await broken(
        "lib/main/version.ts",
        "export const run = (): void => {\n  Promise.resolve(1);\n};\n"
      )
    ).toContain("@typescript-eslint/no-floating-promises");
    expect(
      await broken(
        "lib/main/version.ts",
        "export const pick = (): number => (Promise.resolve(true) ? 1 : 0);\n"
      )
    ).toContain("@typescript-eslint/no-misused-promises");
    expect(
      await broken(
        "lib/main/version.ts",
        "export const wait = async (): Promise<number> => await 1;\n"
      )
    ).toContain("@typescript-eslint/await-thenable");
  });

  it("can do without type information", async () => {
    const untyped = eslintFor(LIBRARY, libraryConfig({ project: false }));
    expect(
      await rulesBroken(
        untyped,
        "lib/main/version.ts",
        "export const run = (): void => {\n  Promise.resolve(1);\n};\n"
      )
    ).toEqual([]);
  });

  it("keeps Electron and Node out of the renderer", async () => {
    expect(
      await broken(
        "lib/renderer.ts",
        'import { ipcRenderer } from "electron";\nexport const bridge = ipcRenderer;\n'
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(
        "lib/renderer.ts",
        'import fs from "fs";\nexport const read = fs.readFileSync;\n'
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken("lib/renderer.ts", "export const cwd = process.cwd();\n")
    ).toEqual(["no-restricted-globals"]);
  });

  it("keeps shared code pure", async () => {
    expect(
      await broken(
        "lib/shared/format.ts",
        'import { app } from "electron/main";\nexport const name = app;\n'
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(
        "lib/shared/format.ts",
        "export const title = (): string => document.title;\n"
      )
    ).toEqual(["no-restricted-globals"]);
    // Zod's types cost nothing at run time; Zod itself does.
    expect(
      await broken(
        "lib/shared/format.ts",
        'import type { ZodType } from "zod";\nexport type Schema = ZodType;\n'
      )
    ).toEqual([]);
    expect(
      await broken(
        "lib/shared/format.ts",
        'import { z } from "zod";\nexport const schema = z.string();\n'
      )
    ).toEqual(["no-restricted-imports"]);
  });

  it("keeps schemas and React out of preload, React out of main", async () => {
    expect(
      await broken(
        "lib/preload.ts",
        'import { z } from "zod";\nexport const schema = z.string();\n'
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(
        "lib/preload.ts",
        "export const later = (run: () => void): void => {\n  setImmediate(run);\n};\n"
      )
    ).toEqual(["no-restricted-globals"]);
    expect(
      await broken(
        "lib/main/version.ts",
        'import { useState } from "react";\nexport const hook = useState;\n'
      )
    ).toEqual(["no-restricted-imports"]);
  });

  it("seals each layer from the others", async () => {
    expect(
      await broken(
        "lib/main/version.ts",
        'import { isVisible } from "../renderer/visible";\nexport const visible = isVisible;\n'
      )
    ).toEqual(["no-restricted-imports"]);
  });

  it("lets a layer obey extra patterns and pick its Zod policy", async () => {
    const custom = eslintFor(
      LIBRARY,
      libraryConfig({
        layers: {
          ...LAYERS,
          renderer: {
            environment: "renderer",
            zod: "allow",
            restrict: [{ group: ["@handijit/ui"], message: "UI-free." }],
          },
        },
      })
    );
    expect(
      await rulesBroken(
        custom,
        "lib/renderer.ts",
        'import { z } from "zod";\nexport const schema = z.string();\n'
      )
    ).toEqual([]);
    expect(
      await rulesBroken(
        custom,
        "lib/renderer.ts",
        'import { Button } from "@handijit/ui";\nexport const B = Button;\n'
      )
    ).toEqual(["no-restricted-imports"]);
  });

  it("applies the Rules of Hooks where React is", async () => {
    const withReact = eslintFor(
      LIBRARY,
      libraryConfig({ react: ["lib/renderer.ts"] })
    );
    expect(
      await rulesBroken(
        withReact,
        "lib/renderer.ts",
        'import { useState } from "react";\nexport const useMaybe = (on: boolean): void => {\n  if (on) useState(0);\n};\n'
      )
    ).toContain("react-hooks/rules-of-hooks");
  });

  it("rejects a focused test", async () => {
    expect(
      await broken(
        "__tests__/format.test.ts",
        'import { it } from "vitest";\nit.only("runs alone", () => undefined);\n'
      )
    ).toEqual(["no-restricted-properties"]);
  });

  it("lints scripts with Node and browser globals, and ignores the build", async () => {
    expect(
      await broken("scripts/run.mjs", "console.log(process.argv, window);\n")
    ).toEqual([]);
    expect(await broken("scripts/run.mjs", "missing();\n")).toEqual([
      "no-undef",
    ]);
    const [ignored] = await eslint.lintText("let x = 1;\n", {
      filePath: "build/index.mjs",
      warnIgnored: true,
    });
    expect(ignored?.messages[0]?.message).toMatch(/ignored/);
  });

  it("seals nothing when only one layer is sealable", () => {
    const config = library({
      rootDir: LIBRARY,
      layers: { main: { environment: "main" } },
    });
    expect(
      config.find(({ name }) => name === "handijit/layer/main")?.rules
    ).toEqual({
      "no-restricted-imports": ["error", { patterns: [patterns.react] }],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "This layer must run without a DOM." },
        { name: "document", message: "This layer must run without a DOM." },
      ],
    });
  });

  it("lints files on disk in single-run mode, as CI and the CLI do", async () => {
    vi.stubEnv("CI", "true");
    const copy = copyFixture("library");
    try {
      writeFileSync(
        join(copy.dir, "lib", "main", "fire.ts"),
        'import { readVersion } from "./version";\n\nexport const fire = (): void => {\n  readVersion();\n};\n'
      );
      const single = new ESLint({
        cwd: copy.dir,
        overrideConfigFile: true,
        overrideConfig: library({ rootDir: copy.dir, layers: LAYERS }),
      });
      const results = await single.lintFiles(["."]);
      expect(
        results.flatMap(({ filePath, messages }) =>
          messages.map(
            ({ ruleId }) => `${filePath.slice(copy.dir.length)} ${ruleId}`
          )
        )
      ).toEqual(["/lib/main/fire.ts @typescript-eslint/no-floating-promises"]);
    } finally {
      copy.remove();
    }
  });

  it("works without layers or options", async () => {
    const plain = eslintFor(LIBRARY, library({ rootDir: LIBRARY }));
    expect(
      await rulesBroken(
        plain,
        "lib/renderer.ts",
        'import { ipcRenderer } from "electron";\nexport const bridge = ipcRenderer;\n'
      )
    ).toEqual([]);
  });
});

describe("the app preset", () => {
  const eslint = eslintFor(APP, app({ rootDir: APP }));
  const broken = (path: string, text: string): Promise<(string | null)[]> =>
    rulesBroken(eslint, path, text);
  const HOOK = "src/renderer/src/hooks/use-greeting.hook.ts";

  it("passes the clean fixture", async () => {
    const results = await eslint.lintFiles(["."]);
    expect(results.flatMap(({ messages }) => messages)).toEqual([]);
    expect(results.map(({ filePath }) => filePath).length).toBeGreaterThan(10);
  });

  it("keeps electron, Node and main out of the renderer", async () => {
    expect(
      await broken(
        HOOK,
        "import { ipcRenderer } from 'electron';\n\nexport const bridge = ipcRenderer;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(
        HOOK,
        "import { greet } from '@main/services/greeting.service';\n\nexport const g = greet;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(HOOK, "export const cwd = (): string => process.cwd();\n")
    ).toEqual(["no-restricted-globals"]);
  });

  it("bans relative imports but a stylesheet", async () => {
    expect(
      await broken(
        HOOK,
        "import { desktop } from '../services/desktop.service';\n\nexport const d = desktop;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(await broken(HOOK, "import './greeting.css';\n")).toEqual([]);
    expect(
      await broken(
        "tests/unit/greeting.service.test.ts",
        "import { greet } from '../../src/main/services/greeting.service';\n\nexport const g = greet;\n"
      )
    ).toEqual(["no-restricted-imports"]);
  });

  it("can allow relative imports", async () => {
    const relaxed = eslintFor(
      APP,
      app({ rootDir: APP, relativeImports: true })
    );
    expect(
      await rulesBroken(
        relaxed,
        HOOK,
        "import { desktop } from '../services/desktop.service';\n\nexport const d = desktop;\n"
      )
    ).toEqual([]);
  });

  it("keeps window.desktop behind the desktop service", async () => {
    expect(
      await broken(HOOK, "export const api = (): unknown => window.desktop;\n")
    ).toEqual(["no-restricted-properties"]);
  });

  it("keeps preload to electron and shared constants and types", async () => {
    const PRELOAD = "src/preload/index.ts";
    expect(
      await broken(
        PRELOAD,
        "import { greeting } from '@shared/helpers/greeting.helper';\n\nexport const g = greeting;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(
        PRELOAD,
        "import { join } from 'node:path';\n\nexport const j = join;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(PRELOAD, "export const bytes = Buffer.from('x');\n")
    ).toEqual(["no-restricted-globals"]);
    expect(
      await broken(
        PRELOAD,
        "import { ipcRenderer } from 'electron';\n\nexport const now = (): unknown => ipcRenderer.sendSync('now');\n"
      )
    ).toEqual(["no-restricted-properties"]);
  });

  it("keeps the renderer out of main and shared pure", async () => {
    expect(
      await broken(
        "src/main/index.ts",
        "import { Greeting } from '@/components/Greeting';\n\nexport const G = Greeting;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(
        "src/shared/helpers/greeting.helper.ts",
        "import { app } from 'electron';\n\nexport const a = app;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await broken(
        "src/shared/helpers/greeting.helper.ts",
        "export const title = (): string => document.title;\n"
      )
    ).toEqual(["no-restricted-globals"]);
  });

  it("orders imports: Node and external, electron, @main, @shared", async () => {
    expect(
      await broken(
        "src/main/index.ts",
        "import { IPC_CHANNELS } from '@shared/constants/ipc-channel.constants';\n\nimport { app } from 'electron';\n\nexport const x = [IPC_CHANNELS, app];\n"
      )
    ).toEqual(["import-x/order"]);
  });

  it("orders the renderer's imports the web way", async () => {
    expect(
      await broken(
        "src/renderer/src/components/Greeting.tsx",
        "import { greeting } from '@shared/helpers/greeting.helper';\n\nimport { useGreeting } from '@/hooks/use-greeting.hook';\n\nexport const x = [greeting, useGreeting];\n"
      )
    ).toEqual(["import-x/order"]);
  });

  it("applies the Rules of Hooks and the promise rules in the renderer", async () => {
    expect(
      await broken(
        HOOK,
        "import { useState } from 'react';\n\nexport const useMaybe = (on: boolean): void => {\n  if (on) useState(0);\n};\n"
      )
    ).toContain("react-hooks/rules-of-hooks");
    expect(
      await broken(
        HOOK,
        "import { desktop } from '@/services/desktop.service';\n\nexport const fire = (): void => {\n  desktop().greet('x');\n};\n"
      )
    ).toContain("@typescript-eslint/no-floating-promises");
  });

  it("can do without type information", async () => {
    const untyped = eslintFor(APP, app({ rootDir: APP, project: false }));
    expect(
      await rulesBroken(
        untyped,
        HOOK,
        "import { desktop } from '@/services/desktop.service';\n\nexport const fire = (): void => {\n  desktop().greet('x');\n};\n"
      )
    ).toEqual([]);
  });
});

describe("the building blocks", () => {
  it("compose a layer of a consumer's own", () => {
    expect(
      layer({
        name: "custom",
        files: ["src/worker/**"],
        environment: "renderer",
        zod: "types",
      }).rules
    ).toMatchObject({
      "no-restricted-imports": [
        "error",
        { patterns: [patterns.node, patterns.electron, patterns.zodTypes] },
      ],
    });
  });

  it("write no rule for an empty list", () => {
    expect(restrictImports([])).toEqual({});
    expect(restrictGlobals([])).toEqual({});
  });
});
