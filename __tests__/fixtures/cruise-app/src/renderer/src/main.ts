// Breaks a rule on purpose: the renderer imports main's code.
import { start } from "../../main/index";
import { CHANNELS } from "../../shared/constants/channels";

export const render = (): string => `${CHANNELS.ping}:${start()}`;
