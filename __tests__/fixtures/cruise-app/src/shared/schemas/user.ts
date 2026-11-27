// Breaks a rule on purpose: shared code reaches Node.
import { basename } from "node:path";

export const userName = (path: string): string => basename(path);
