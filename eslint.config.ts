import { library } from "./lib/eslint";

// The repository lints itself with its own preset, loaded from the source: no build needed.
// The fixtures break the rules on purpose; the tests lint them.
export default library({
  rootDir: import.meta.dirname,
  ignores: ["__tests__/fixtures/**"],
});
