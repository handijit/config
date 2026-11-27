const load = async (): Promise<number> => 1;

/** Starts loading and forgets the promise: its rejection would be lost. */
const run = (): void => {
  load();
};

export default run;
