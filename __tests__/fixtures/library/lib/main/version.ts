import { release } from "node:os";

import { formatVersion } from "../shared/format";

/** The version main reports, read the way a real one would be: asynchronously. */
export const readVersion = async (): Promise<string> => {
  const name = await Promise.resolve(release());
  return formatVersion(name.split(".").length, name.length);
};
