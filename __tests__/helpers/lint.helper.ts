import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import type { Linter } from "eslint";

/** The directory of a fixture under `__tests__/fixtures`. */
const fixture = (name: string): string =>
  fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));

/**
 * Lints `code` as if it were the file `file` (relative to `cwd`) with exactly `configs`, and
 * returns the rule of every message; a parse error shows up as `null`.
 */
const lintText = async (
  configs: Linter.Config[],
  cwd: string,
  file: string,
  code: string
): Promise<(string | null)[]> => {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: configs,
  });
  const results = await eslint.lintText(code, { filePath: `${cwd}${file}` });
  return results.flatMap(({ messages }) =>
    messages.map(({ ruleId }) => ruleId)
  );
};

/** The config object a preset or building block names `name`. */
const named = (configs: Linter.Config[], name: string): Linter.Config => {
  const config = configs.find((candidate) => candidate.name === name);
  if (config === undefined) throw new Error(`No config named ${name}`);
  return config;
};

export { fixture, lintText, named };
