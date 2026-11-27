import prettierConfig from "eslint-config-prettier/flat";
import { describe, expect, test } from "vitest";

import app from "../lib/eslint/app";
import { fixture, lintText, named } from "./helpers/lint.helper";

const CWD = fixture("cruise-app");

const preset = app({ rootDir: CWD, project: false });
const lint = (file: string, code: string): Promise<(string | null)[]> =>
  lintText(preset, CWD, file, code);

const IMPORTS = ["no-restricted-imports"];
const PROPERTIES = ["no-restricted-properties"];

describe("app preset", () => {
  test("should stack the blocks in order, Prettier last", () => {
    const configs = app({ rootDir: CWD });
    expect(configs.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "handijit/ignores",
        "handijit/typescript",
        "handijit/type-checked",
        "handijit/react",
        "handijit/tests",
        "handijit/layer/main",
        "handijit/layer/preload",
        "handijit/layer/renderer",
        "handijit/layer/shared",
        "handijit/tests/imports",
        "handijit/ipc",
        "handijit/ipc/desktop-service",
        "handijit/order/node",
        "handijit/order/web",
        "handijit/scripts",
      ])
    );
    expect(configs.at(-1)).toBe(prettierConfig);
    expect(
      named(configs, "handijit/type-checked").languageOptions?.parserOptions
    ).toEqual({
      project: ["./tsconfig.node.json", "./tsconfig.web.json"],
      tsconfigRootDir: CWD,
    });
    expect(named(configs, "handijit/react").files).toEqual([
      "src/renderer/**/*.{ts,tsx}",
    ]);
    expect(named(configs, "handijit/tests").files).toEqual([
      "tests/**/*.{ts,tsx}",
    ]);
  });

  test("should drop the type-aware rules on request", () => {
    expect(preset.map(({ name }) => name)).not.toContain(
      "handijit/type-checked"
    );
  });

  test("should honour every option", () => {
    const configs = app({
      rootDir: CWD,
      project: "./tsconfig.json",
      main: ["app/main/**/*.ts"],
      preload: ["app/preload/**/*.ts"],
      renderer: ["app/page/**/*.tsx"],
      shared: ["app/common/**/*.ts"],
      tests: ["spec/**/*.ts"],
      typed: ["app/**/*.ts"],
      desktopService: ["app/page/bridge.ts"],
      relativeImports: true,
      ignores: ["vendor/**"],
    });
    expect(named(configs, "handijit/ignores").ignores).toContain("vendor/**");
    expect(named(configs, "handijit/type-checked").files).toEqual([
      "app/**/*.ts",
    ]);
    expect(named(configs, "handijit/layer/main").files).toEqual([
      "app/main/**/*.ts",
    ]);
    expect(named(configs, "handijit/layer/preload").files).toEqual([
      "app/preload/**/*.ts",
    ]);
    expect(named(configs, "handijit/layer/renderer").files).toEqual([
      "app/page/**/*.tsx",
    ]);
    expect(named(configs, "handijit/layer/shared").files).toEqual([
      "app/common/**/*.ts",
    ]);
    expect(named(configs, "handijit/ipc/desktop-service").files).toEqual([
      "app/page/bridge.ts",
    ]);
    // Relative imports allowed: the tests carry no import rule at all.
    expect(named(configs, "handijit/tests/imports").rules).toEqual({});
  });

  test("should order imports: Node and external, electron, @main, @shared", () => {
    const order = named(preset, "handijit/order/node");
    expect(order.files).toEqual([
      "src/main/**/*.ts",
      "src/preload/**/*.ts",
      "src/shared/**/*.ts",
    ]);
    expect(order.settings).toEqual({
      "import-x/internal-regex": "^@(/|main/|shared/)",
    });
    expect(order.rules?.["import-x/order"]).toMatchObject([
      "error",
      {
        pathGroups: [
          { pattern: "electron{,/**}", group: "external", position: "after" },
          { pattern: "@main/**", group: "internal", position: "before" },
          { pattern: "@shared/**", group: "internal", position: "after" },
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ]);
    expect(named(preset, "handijit/order/web").files).toEqual([
      "src/renderer/**/*.{ts,tsx}",
    ]);
  });
});

describe("app preset, applied", () => {
  test("should accept a main file in the house order and reject another order", async () => {
    expect(
      await lint(
        "src/main/index.ts",
        [
          'import { join } from "node:path";',
          "",
          'import { app } from "electron";',
          "",
          'import { createWindow } from "@main/windows/main-window";',
          "",
          'import { CHANNELS } from "@shared/constants/channels";',
          "",
          "export const start = (): unknown => [join, app, createWindow, CHANNELS];",
          "",
        ].join("\n")
      )
    ).toEqual([]);
    expect(
      await lint(
        "src/main/other.ts",
        [
          'import { CHANNELS } from "@shared/constants/channels";',
          'import { app } from "electron";',
          "",
          "export const start = (): unknown => [app, CHANNELS];",
          "",
        ].join("\n")
      )
    ).toContain("import-x/order");
  });

  test("should ban relative imports but a component's own stylesheet", async () => {
    expect(
      await lint(
        "src/renderer/src/components/a.tsx",
        'import { helper } from "../helpers/helper";\n\nexport const A = (): unknown => helper;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint(
        "src/renderer/src/components/b.tsx",
        'import "./b.css";\n\nexport const B = (): null => null;\n'
      )
    ).toEqual([]);
    expect(
      await lint(
        "tests/unit/a.test.ts",
        'import { CHANNELS } from "../../src/shared/constants/channels";\n\nexport const c = (): unknown => CHANNELS;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint(
        "tests/unit/b.test.ts",
        'import { CHANNELS } from "@shared/constants/channels";\n\nexport const c = (): unknown => CHANNELS;\n'
      )
    ).toEqual([]);
    const relaxed = app({
      rootDir: CWD,
      project: false,
      relativeImports: true,
    });
    expect(
      await lintText(
        relaxed,
        CWD,
        "src/renderer/src/components/a.tsx",
        'import { helper } from "../helpers/helper";\n\nexport const A = (): unknown => helper;\n'
      )
    ).toEqual([]);
  });

  test("should keep each process to its own code", async () => {
    expect(
      await lint(
        "src/main/a.ts",
        'import { page } from "@/page";\n\nexport const a = (): unknown => page;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint(
        "src/shared/a.ts",
        'import { start } from "@main/index";\n\nexport const a = (): unknown => start;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint(
        "src/renderer/src/a.ts",
        'import { start } from "@main/index";\n\nexport const a = (): unknown => start;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint(
        "src/preload/a.ts",
        'import { userSchema } from "@shared/schemas/user";\n\nexport const a = (): unknown => userSchema;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint(
        "src/preload/b.ts",
        'import { contextBridge } from "electron";\n\nimport { CHANNELS } from "@shared/constants/channels";\n\nexport const b = (): unknown => [contextBridge, CHANNELS];\n'
      )
    ).toEqual([]);
  });

  test("should keep window.desktop in the desktop service and ban synchronous IPC", async () => {
    expect(
      await lint(
        "src/renderer/src/hooks/use-desktop.ts",
        "export const read = (): unknown => window.desktop;\n"
      )
    ).toEqual(PROPERTIES);
    expect(
      await lint(
        "src/renderer/src/services/desktop.service.ts",
        "export const read = (): unknown => window.desktop;\n"
      )
    ).toEqual([]);
    expect(
      await lint(
        "src/renderer/src/services/desktop.service.ts",
        'declare const ipcRenderer: { sendSync: (channel: string) => unknown };\n\nexport const ping = (): unknown => ipcRenderer.sendSync("ping");\n'
      )
    ).toEqual(PROPERTIES);
  });

  test("should apply the Rules of Hooks in the renderer", async () => {
    expect(
      await lint(
        "src/renderer/src/components/c.tsx",
        [
          'import { useState } from "react";',
          "",
          "export const C = ({ on }: { on: boolean }): number => {",
          "  if (on) {",
          "    const [count] = useState(0);",
          "    return count;",
          "  }",
          "  return 0;",
          "};",
          "",
        ].join("\n")
      )
    ).toContain("react-hooks/rules-of-hooks");
  });
});
