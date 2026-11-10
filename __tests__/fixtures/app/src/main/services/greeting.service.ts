import { greeting } from '@shared/helpers/greeting.helper';

/** Greets someone, the way main answers an IPC call: asynchronously. */
export const greet = async (name: string): Promise<string> => {
  const trimmed = await Promise.resolve(name.trim());
  return greeting(trimmed);
};
