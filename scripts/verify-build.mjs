import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";

// Checks what was written to build/: each entry imports only Node built-ins and packages the
// manifest lists (so a consumer's install has them), the Prettier and Vitest-setup entries stay
// free of ESLint, and every path package.json promises exists.

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const problems = [];

if (!existsSync("build/eslint.mjs")) {
  console.error('verify-build: build/ is missing; run "npm run build" first');
  process.exit(1);
}

const listed = new Set([
  ...Object.keys(manifest.dependencies),
  ...Object.keys(manifest.peerDependencies),
]);
const packageOf = (specifier) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");
const isBuiltin = (specifier) =>
  specifier.startsWith("node:") || builtinModules.includes(specifier);

const importsOf = (file) => [
  ...new Set(
    [
      ...readFileSync(file, "utf8").matchAll(
        /^\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/gm
      ),
      ...readFileSync(file, "utf8").matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm),
    ].map(([, name]) => name)
  ),
];

// The tools each entry may load at run time; a peer outside this list would force a consumer
// of that entry to install a tool it does not use.
const ALLOWED = {
  eslint: () => true,
  prettier: () => false,
  "prettier-app": () => false,
  vitest: (name) => name === "vitest",
  "vitest-setup": (name) => name === "vitest",
  "dependency-cruiser": () => false,
};

for (const [entry, allowed] of Object.entries(ALLOWED)) {
  for (const specifier of importsOf(`build/${entry}.mjs`)) {
    if (specifier.startsWith(".") || isBuiltin(specifier)) continue;
    const name = packageOf(specifier);
    if (!listed.has(name)) {
      problems.push(
        `build/${entry}.mjs imports ${name}, which package.json does not list`
      );
    } else if (!allowed(name)) {
      problems.push(`build/${entry}.mjs must not import ${name}`);
    }
  }
}

const paths = Object.values(manifest.exports).flatMap((target) =>
  typeof target === "string" ? [target] : Object.values(target)
);
for (const path of paths.filter((path) => !path.includes("*"))) {
  if (!existsSync(path))
    problems.push(`package.json exports ${path}, which does not exist`);
}

if (problems.length > 0) {
  console.error(
    problems.map((problem) => `verify-build: ${problem}`).join("\n")
  );
  process.exit(1);
}
console.log("verify-build: every entry imports only what it may");
