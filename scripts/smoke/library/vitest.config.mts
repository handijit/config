import { library } from "@handijit/config/vitest";

export default library({
  barrels: ["lib/index.ts", "lib/main.ts", "lib/preload.ts"],
});
