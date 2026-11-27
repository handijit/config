import { globSync } from "node:fs";

import type { TestProject } from "vitest/node";

/**
 * The global setup file the Vitest presets load. With coverage on, it fails the run before any
 * test when `coverage.include`, less `coverage.exclude`, matches no file: Vitest would report
 * 0 of 0 lines as 100 % covered, and the gate would pass on source it never measured (a wrong
 * `source` directory, a mistyped glob, an exclude that swallows everything).
 */
const guardCoverage = ({ vitest }: Pick<TestProject, "vitest">): void => {
  const { root, coverage } = vitest.config;
  // Without an include, Vitest measures whatever the tests load; there is no glob to check.
  if (!coverage.enabled || coverage.include === undefined) return;
  const measured = globSync(coverage.include, {
    cwd: root,
    exclude: coverage.exclude,
    withFileTypes: true,
  }).filter((entry) => entry.isFile());
  if (measured.length === 0) {
    throw new Error(
      `Coverage would measure no file: coverage.include ${JSON.stringify(coverage.include)}, ` +
        `less coverage.exclude, matches nothing under ${root}; 0 of 0 lines would pass the ` +
        `threshold. Check the preset's source directory and barrels.`
    );
  }
};

export default guardCoverage;
