import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  IConfiguration,
  IRegularForbiddenRuleType,
} from "dependency-cruiser";
import { afterAll, describe, expect, test } from "vitest";

import { app, library } from "../lib/dependency-cruiser";
import { fixture } from "./helpers/lint.helper";

const DEPCRUISE = fileURLToPath(
  new URL("../node_modules/.bin/depcruise", import.meta.url)
);
const SCRATCH = mkdtempSync(join(tmpdir(), "handijit-config-cruise-"));

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

/** Runs the dependency-cruiser CLI over `source` of a fixture and returns the broken rules. */
const cruise = (
  config: IConfiguration,
  name: string,
  source: string
): string[] => {
  const configFile = join(SCRATCH, `${name}.json`);
  writeFileSync(configFile, JSON.stringify(config));
  const { stdout, stderr } = spawnSync(
    DEPCRUISE,
    [source, "--config", configFile, "--output-type", "json"],
    { cwd: fixture(name), encoding: "utf8" }
  );
  if (stdout === "") throw new Error(stderr);
  const result = JSON.parse(stdout) as {
    summary: { violations: { rule: { name: string } }[] };
  };
  return [
    ...new Set(result.summary.violations.map(({ rule }) => rule.name)),
  ].sort();
};

// Both presets write regular "from → to" rules only.
const rules = (config: IConfiguration): IRegularForbiddenRuleType[] =>
  (config.forbidden ?? []) as IRegularForbiddenRuleType[];

const names = (config: IConfiguration): string[] =>
  (config.forbidden ?? []).map(({ name }) => name ?? "");

const HOUSE_PRELOAD = (): RegExp => {
  const rule = rules(app()).find(
    ({ name }) => name === "preload-only-electron"
  );
  const pathNot = rule?.to.pathNot;
  if (!Array.isArray(pathNot)) throw new Error("no pathNot list");
  return new RegExp(pathNot[1] ?? "(?!)");
};

describe("dependency-cruiser library preset", () => {
  test("should hold the common rules and resolve like TypeScript", () => {
    const config = library();
    expect(names(config)).toEqual([
      "no-circular",
      "no-orphans",
      "not-to-unresolvable",
      "no-non-package-json",
      "not-to-test",
      "not-to-dev-dep",
    ]);
    expect(config.options).toMatchObject({
      doNotFollow: { path: "node_modules" },
      tsPreCompilationDeps: "specify",
      tsConfig: { fileName: "tsconfig.json" },
      skipAnalysisNotInRules: true,
    });
    expect(
      config.forbidden?.every(({ severity }) => severity === "error")
    ).toBe(true);
  });

  test("should write the environment and seal rules of each layer", () => {
    const config = library({
      source: "src",
      tests: "test",
      tsConfig: "tsconfig.build.json",
      entries: ["^src/cli\\.ts$"],
      layers: {
        shared: { environment: "shared", path: "^src/(index\\.ts$|shared/)" },
        main: { environment: "main" },
        preload: { environment: "preload" },
        renderer: { environment: "renderer" },
      },
    });
    expect(names(config)).toEqual([
      "no-circular",
      "no-orphans",
      "not-to-unresolvable",
      "no-non-package-json",
      "not-to-test",
      "not-to-dev-dep",
      "shared-not-to-node",
      "shared-not-to-electron",
      "shared-not-to-react",
      "shared-not-to-main",
      "shared-not-to-preload",
      "shared-not-to-renderer",
      "main-not-to-react",
      "main-not-to-preload",
      "main-not-to-renderer",
      "preload-not-to-node",
      "preload-not-to-react",
      "preload-not-to-main",
      "preload-not-to-renderer",
      "renderer-not-to-node",
      "renderer-not-to-electron",
      "renderer-not-to-main",
      "renderer-not-to-preload",
    ]);
    const byName = new Map(rules(config).map((rule) => [rule.name, rule]));
    expect(byName.get("main-not-to-renderer")).toMatchObject({
      from: { path: "^src/main(\\.tsx?$|/)" },
      to: {
        path: "^src/renderer(\\.tsx?$|/)",
        dependencyTypesNot: ["aliased-tsconfig-paths"],
      },
    });
    expect(byName.get("not-to-test")).toMatchObject({
      from: { path: "^src/" },
      to: { path: "^test/" },
    });
    expect(byName.get("no-orphans")?.from.pathNot).toContain("^src/cli\\.ts$");
    expect(config.options?.tsConfig).toEqual({
      fileName: "tsconfig.build.json",
    });
  });

  test("should catch a layer reaching Node or another layer", () => {
    expect(
      cruise(
        library({
          layers: {
            shared: {
              environment: "shared",
              path: "^lib/(index\\.ts$|shared/)",
            },
            main: { environment: "main" },
            renderer: { environment: "renderer" },
          },
        }),
        "cruise-library",
        "lib"
      )
    ).toEqual(["renderer-not-to-main", "renderer-not-to-node"]);
  });
});

describe("dependency-cruiser app preset", () => {
  test("should hold the layer rules of ELECTRON_APP.md section 4", () => {
    expect(names(app())).toEqual([
      "no-circular",
      "no-orphans",
      "not-to-unresolvable",
      "no-non-package-json",
      "renderer-not-to-node",
      "renderer-not-to-electron",
      "renderer-not-to-main-or-preload",
      "preload-not-to-node",
      "preload-not-to-react",
      "preload-not-to-main-or-renderer",
      "preload-only-shared-constants-and-types",
      "preload-only-electron",
      "main-not-to-renderer-or-preload",
      "main-not-to-react",
      "shared-not-to-node",
      "shared-not-to-electron",
      "shared-not-to-react",
      "shared-not-to-processes",
    ]);
  });

  test("should let preload use the /preload entry of any @handijitcom package only", () => {
    const house = HOUSE_PRELOAD();
    for (const path of [
      "@handijitcom/electron/preload",
      "@handijitcom/subscription/preload",
      "node_modules/@handijitcom/electron/build/preload.mjs",
      "../node_modules/@handijitcom/electron/build/preload.cjs",
    ]) {
      expect(house.test(path)).toBe(true);
    }
    for (const path of [
      "@handijitcom/electron",
      "@handijitcom/electron/main",
      "@handijitcom/electron/preload/extra",
      "@handijit/electron/preload",
      "@other/electron/preload",
      "node_modules/@handijitcom/electron/build/main.mjs",
    ]) {
      expect(house.test(path)).toBe(false);
    }
  });

  test("should honour every option", () => {
    const config = app({
      main: "^app/main/",
      preload: "^app/preload/",
      renderer: "^app/page/",
      shared: "^app/common/",
      sharedForPreload: "^app/common/channels/",
      tsConfig: "tsconfig.paths.json",
      entries: ["^app/worker\\.ts$"],
    });
    const byName = new Map(rules(config).map((rule) => [rule.name, rule]));
    expect(byName.get("preload-only-shared-constants-and-types")).toMatchObject(
      {
        from: { path: "^app/preload/" },
        to: { path: "^app/common/", pathNot: "^app/common/channels/" },
      }
    );
    expect(byName.get("shared-not-to-processes")?.to.path).toEqual([
      "^app/main/",
      "^app/preload/",
      "^app/page/",
    ]);
    expect(byName.get("no-orphans")?.from.pathNot).toContain(
      "^app/worker\\.ts$"
    );
    expect(config.options?.tsConfig).toEqual({
      fileName: "tsconfig.paths.json",
    });
  });

  test("should catch each process reaching what it may not", () => {
    expect(cruise(app(), "cruise-app", "src")).toEqual([
      "preload-only-shared-constants-and-types",
      "renderer-not-to-main-or-preload",
      "shared-not-to-node",
    ]);
  });
});
