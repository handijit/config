import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

/** The repository's root. */
export const ROOT = resolve(import.meta.dirname, "..");

const FIXTURES = join(ROOT, "__tests__", "fixtures");

/** The absolute path of a fixture project. */
export const fixture = (name: "library" | "app"): string =>
  join(FIXTURES, name);

/**
 * A throwaway copy of a fixture, next to the original so its relative `extends` and the
 * electron stand-in still resolve. The caller removes it with `remove`.
 */
export const copyFixture = (
  name: "library" | "app"
): { dir: string; remove: () => void } => {
  const dir = mkdtempSync(join(FIXTURES, ".scratch-"));
  cpSync(fixture(name), dir, { recursive: true });
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
};

/** Runs one of the repository's binaries in `cwd`, returning its exit code and output. */
export const run = (
  binary: string,
  args: string[],
  cwd: string
): { status: number | null; output: string } => {
  const result = spawnSync(join(ROOT, "node_modules", ".bin", binary), args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
};
