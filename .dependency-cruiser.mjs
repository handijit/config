// The repository cruises itself with its own library preset, loaded from the source.
import { createJiti } from "jiti";

const { library } = await createJiti(import.meta.url).import(
  "./lib/dependency-cruiser.ts"
);

export default library();
