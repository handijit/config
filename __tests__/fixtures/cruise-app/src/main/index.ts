import { join } from "node:path";

import { CHANNELS } from "../shared/constants/channels";
import { userName } from "../shared/schemas/user";

export const start = (): string => join(CHANNELS.ping, userName("a/b"));
