import { describe, expect, it } from 'vitest';

import { greet } from '@main/services/greeting.service';

describe('greet', () => {
  it('greets a trimmed name', async () => {
    await expect(greet(' Ada ')).resolves.toBe('Hello, Ada');
  });
});
