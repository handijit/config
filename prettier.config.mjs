// The repository formats itself with its own library style, loaded from the source.
import { createJiti } from "jiti";

export default await createJiti(import.meta.url).import("./lib/prettier.ts", {
  default: true,
});
