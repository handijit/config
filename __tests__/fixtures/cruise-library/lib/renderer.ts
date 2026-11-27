// Breaks two rules on purpose: the renderer reaches Node and another layer's code.
import { join } from "node:path";

import { read } from "./main";

export const show = (): string => read(join("a", "b"));
