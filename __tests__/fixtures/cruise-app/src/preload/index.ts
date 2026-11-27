// Breaks a rule on purpose: preload takes a schema from shared.
import { CHANNELS } from "../shared/constants/channels";
import { userName } from "../shared/schemas/user";

export const bridge = { channels: CHANNELS, userName };
