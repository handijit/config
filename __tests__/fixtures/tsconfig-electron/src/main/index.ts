import { CHANNEL } from "@shared/constants";

export const where = (): string => `${CHANNEL}:${process.cwd()}`;
