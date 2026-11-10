import { app } from '@handijit/config/vitest';

export default app({
  rootDir: import.meta.dirname,
  thresholds: { lines: 35, functions: 40, branches: 100, statements: 40 },
});
