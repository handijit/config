// The repository lints itself with its own library preset, loaded from the source.
import { createJiti } from "jiti";

const { library } = await createJiti(import.meta.url).import("./lib/eslint.ts");

export default library({
  rootDir: import.meta.dirname,
  // The fixtures break rules on purpose; the tests lint them with the presets under test.
  ignores: ["__tests__/fixtures/**"],
});
