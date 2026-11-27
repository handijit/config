import { readFileSync } from "node:fs";

import greet from "./shared/greet";

export const read = (path: string): string => greet(readFileSync(path, "utf8"));
